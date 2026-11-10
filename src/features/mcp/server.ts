/**
 * Personal MCP server: one instance per request, bound to one user.
 * Read tools load the whole book once per call (small data, always fresh).
 */
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { z } from 'zod';
import { loadBook } from './book';
import { getAssets, getBudget, getCashflow, getGoals, getOverview, getReference, getUpcoming, listTransactions } from './read';
import {
  addTransaction,
  audit,
  deleteGoal,
  deleteTransaction,
  setAssetPrice,
  setGoal,
  settleDue,
  updateTransaction,
  type WriteResult,
} from './write';

const date = z.string().regex(/^\d{4}\/\d{2}\/\d{2}$/).describe('Jalali date YYYY/MM/DD');
const ref = z.object({ kind: z.enum(['wallet', 'asset', 'person']), id: z.string() });
const txType = z.enum(['EXPENSE', 'INCOME', 'TRANSFER', 'BUY', 'SELL']);
const txFields = {
  date: date.optional(),
  from: ref.optional().describe('Source. EXPENSE/TRANSFER/BUY: a wallet (or person). SELL: the asset.'),
  to: ref.optional().describe('Target. INCOME/TRANSFER/SELL: a wallet (or person). BUY: the asset.'),
  amount: z.number().positive().optional().describe('EXPENSE/INCOME money; TRANSFER source amount. In the wallet currency.'),
  to_amount: z.number().positive().optional().describe('TRANSFER between currencies: amount that arrived.'),
  quantity: z.number().positive().optional().describe('BUY/SELL: asset quantity.'),
  price_toman: z.number().positive().optional().describe('BUY/SELL: unit price in Toman.'),
  category_id: z.string().nullable().optional(),
  note: z.string().max(500).nullable().optional(),
};

const READ = { readOnlyHint: true, destructiveHint: false, openWorldHint: false } as const;
const WRITE = { readOnlyHint: false, destructiveHint: false, openWorldHint: false } as const;
const DELETE = { readOnlyHint: false, destructiveHint: true, openWorldHint: false } as const;

const json = (v: unknown) => ({ content: [{ type: 'text' as const, text: JSON.stringify(v) }] });

export function createKharjookServer(userId: string) {
  const server = new McpServer(
    { name: 'kharjook', version: '1.0.0' },
    {
      instructions:
        'Personal finance book of one user (Kharjook). Money is in Toman unless a unit is given; dates are Jalali YYYY/MM/DD. ' +
        'Call get_reference first to learn wallet/asset/category/person ids before you write. ' +
        'Before any write, tell the user exactly what you will change. Deletes need confirm: true.',
    }
  );

  const read = <A,>(name: string, title: string, description: string, inputSchema: z.ZodRawShape, fn: (book: Awaited<ReturnType<typeof loadBook>>, a: A) => unknown) =>
    server.registerTool(name, { title, description, inputSchema, annotations: READ }, async (a: unknown) =>
      json(fn(await loadBook(userId), a as A))
    );

  const write = <A,>(
    name: string,
    title: string,
    description: string,
    inputSchema: z.ZodRawShape,
    annotations: typeof WRITE | typeof DELETE,
    fn: (book: Awaited<ReturnType<typeof loadBook>>, a: A) => Promise<WriteResult>
  ) =>
    server.registerTool(name, { title, description, inputSchema, annotations }, async (a: unknown) => {
      let r: WriteResult;
      try {
        r = await fn(await loadBook(userId), a as A);
      } catch (e) {
        r = { ok: false, error: e instanceof Error ? e.message : 'failed' };
      }
      await audit(userId, name, a, r).catch(() => undefined);
      return r.ok ? json(r) : { ...json(r), isError: true };
    });

  // ---- read ----
  read('get_overview', 'Overview', 'Net worth (Toman + USD), cash, allocation by asset group, profit (active / this year / all time, in Toman and USD), goal counts.', {}, (b) => getOverview(b));
  read('get_assets', 'Assets', 'Every asset with quantity, price, value, cost, profit and share of the portfolio.', {}, (b) => getAssets(b));
  read('get_goals', 'Portfolio goals', 'Target vs actual for each goal (quantity or allocation %), drift, and suggested action.', {}, (b) => getGoals(b));
  read<Parameters<typeof listTransactions>[1]>(
    'list_transactions',
    'Transactions',
    'Search the ledger. Newest first. Max 300 rows.',
    {
      from: date.optional(),
      to: date.optional(),
      type: z.enum(['EXPENSE', 'INCOME', 'TRANSFER', 'BUY', 'SELL']).optional(),
      category_id: z.string().optional(),
      wallet_id: z.string().optional(),
      asset_id: z.string().optional(),
      text: z.string().optional().describe('Text in the note or title'),
      limit: z.number().int().min(1).max(300).optional(),
    },
    (b, a) => listTransactions(b, a)
  );
  read<{ from: string; to: string }>('get_cashflow', 'Cash flow', 'Income and expense in Toman for a period, by category.', { from: date, to: date }, (b, a) => getCashflow(b, a.from, a.to));
  read<{ days?: number }>(
    'get_upcoming',
    'Upcoming dues',
    'Cheques, loan installments and subscriptions due in the next N days (default 30), with overdue ones.',
    { days: z.number().int().min(1).max(365).optional() },
    (b, a) => getUpcoming(b, a.days ?? 30)
  );
  read<{ month?: string }>(
    'get_budget',
    'Budget',
    'Monthly budget envelopes: limit, spent, left per category. month = Jalali YYYY/MM (default this month).',
    { month: z.string().regex(/^\d{4}\/\d{2}$/).optional() },
    (b, a) => getBudget(b, a.month)
  );
  read('get_reference', 'Ids and names', 'Wallets (with balance and currency), assets, categories and persons with their ids. Use these ids in writes.', {}, (b) => getReference(b));

  // ---- write ----
  write<Parameters<typeof addTransaction>[1]>(
    'add_transaction',
    'Add transaction',
    'Add EXPENSE, INCOME, TRANSFER, BUY or SELL. Same checks as the app form (balance, required fields).',
    { type: txType, ...txFields },
    WRITE,
    (b, a) => addTransaction(b, a)
  );
  write<{ id: string } & Parameters<typeof updateTransaction>[2]>(
    'update_transaction',
    'Edit transaction',
    'Change fields of one transaction. Fields you do not send stay as they are.',
    { id: z.string(), type: txType.optional(), ...txFields },
    WRITE,
    (b, { id, ...patch }) => updateTransaction(b, id, patch)
  );
  write<{ id: string; confirm?: boolean }>(
    'delete_transaction',
    'Delete transaction',
    'Delete one transaction. Needs confirm: true.',
    { id: z.string(), confirm: z.boolean().optional() },
    DELETE,
    (b, a) => deleteTransaction(b, a.id, a.confirm === true)
  );
  write<Parameters<typeof setGoal>[1]>(
    'set_goal',
    'Add or edit goal',
    'Portfolio goal. scope asset: target quantity or allocation % of one asset. scope asset_group: allocation % of an asset category. Send id to edit.',
    {
      id: z.string().optional(),
      scope: z.enum(['asset', 'asset_group']),
      asset_id: z.string().optional(),
      category_id: z.string().optional(),
      kind: z.enum(['quantity', 'allocation_percent']),
      value: z.number().positive(),
    },
    WRITE,
    (b, a) => setGoal(b, a)
  );
  write<{ id: string; confirm?: boolean }>(
    'delete_goal',
    'Delete goal',
    'Delete one goal. Needs confirm: true.',
    { id: z.string(), confirm: z.boolean().optional() },
    DELETE,
    (b, a) => deleteGoal(b, a.id, a.confirm === true)
  );
  write<Parameters<typeof settleDue>[1]>(
    'settle_due',
    'Pay a due item',
    'Pay a cheque, a loan installment (amount = partial pay in loan currency) or a subscription. Records the payment transaction.',
    {
      kind: z.enum(['check', 'installment', 'subscription']),
      id: z.string(),
      wallet_id: z.string().optional(),
      amount: z.number().positive().optional(),
    },
    WRITE,
    (b, a) => settleDue(b, a)
  );
  write<Parameters<typeof setAssetPrice>[1]>(
    'set_asset_price',
    'Set asset price',
    'Save a manual price in Toman for an asset on a date (default today).',
    { asset_id: z.string(), price_toman: z.number().positive(), date: date.optional() },
    WRITE,
    (b, a) => setAssetPrice(b, a)
  );

  return server;
}

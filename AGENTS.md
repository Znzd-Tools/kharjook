<!-- BEGIN:nextjs-agent-rules -->
# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` before writing any code. Heed deprecation notices.
<!-- END:nextjs-agent-rules -->

# Design system

New UI uses `@/design-system` only (components, tokens, `toast`, `useConfirm`).
- Tokens: `src/design-system/styles/tokens.css`. Use token classes (`bg-panel`, `text-fg-muted`, `rounded-card`, `text-title`), never raw hex, `slate-*`, `purple-*` or `text-[Npx]`.
- Money: always `Amount` / `AmountField`. Dates: `DateField` / `Calendar`.
- Docs and examples: `pnpm storybook` (Introduction page has the old → new migration map).

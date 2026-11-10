import { WebStandardStreamableHTTPServerTransport } from '@modelcontextprotocol/sdk/server/webStandardStreamableHttp.js';
import { createKharjookServer } from '@/features/mcp/server';
import { tokenFrom, userForToken } from '@/features/mcp/token';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const maxDuration = 60;

/** Personal MCP endpoint (stateless Streamable HTTP, JSON answers). */
async function handle(req: Request) {
  const token = tokenFrom(req);
  const userId = token ? await userForToken(token) : null;
  if (!userId) {
    return Response.json({ jsonrpc: '2.0', error: { code: -32001, message: 'Unauthorized' }, id: null }, { status: 401 });
  }
  const server = createKharjookServer(userId);
  const transport = new WebStandardStreamableHTTPServerTransport({ sessionIdGenerator: undefined, enableJsonResponse: true });
  await server.connect(transport);
  try {
    return await transport.handleRequest(req);
  } finally {
    void server.close();
  }
}

export { handle as GET, handle as POST, handle as DELETE };

import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { InMemoryTransport } from '@modelcontextprotocol/sdk/inMemory.js';
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';

import { RouletteMcpService } from '../src/roulette/roulette-mcp.service';
import { RouletteSessionsService } from '../src/roulette/roulette-sessions.service';

function readToolPayload<T>(result: unknown): T {
  if (!result || typeof result !== 'object' || !('content' in result)) {
    throw new Error('Expected an MCP tool result with content.');
  }

  const content = (result as { content: Array<{ type: string; text?: string }> }).content;
  const textContent = content.find((entry) => entry.type === 'text');

  if (!textContent?.text) {
    throw new Error('Expected a text MCP tool result.');
  }

  return JSON.parse(textContent.text) as T;
}

describe('RouletteMcpService', () => {
  let rouletteSessionsService: RouletteSessionsService;
  let rouletteMcpService: RouletteMcpService;
  let mcpServer: McpServer;
  let client: Client;

  beforeEach(async () => {
    rouletteSessionsService = new RouletteSessionsService();
    rouletteMcpService = new RouletteMcpService(rouletteSessionsService);
    mcpServer = rouletteMcpService.createServer();
    client = new Client({
      name: 'roulette-mcp-test-client',
      version: '1.0.0'
    });

    const [clientTransport, serverTransport] = InMemoryTransport.createLinkedPair();
    await mcpServer.connect(serverTransport);
    await client.connect(clientTransport);
  });

  afterEach(async () => {
    await client.close();
    await mcpServer.close();
    rouletteSessionsService.onModuleDestroy();
  });

  it('exposes roulette tools through MCP', async () => {
    const { tools } = await client.listTools();

    expect(tools.map((tool) => tool.name)).toEqual(
      expect.arrayContaining([
        'roulette_create_session',
        'roulette_get_session',
        'roulette_add_value',
        'roulette_remove_value',
        'roulette_draw',
        'roulette_remove_last_draw',
        'roulette_keep_last_draw'
      ])
    );
  });

  it('runs a roulette lifecycle through MCP tools', async () => {
    const createdResult = await client.callTool({
      name: 'roulette_create_session',
      arguments: {
        values: ['Alice']
      }
    });
    const created = readToolPayload<{
      ownerToken: string;
      session: { code: string; values: string[] };
    }>(createdResult);

    expect(created.ownerToken).toMatch(/^roulette_owner_/);
    expect(created.session.values).toEqual(['Alice']);

    const addedResult = await client.callTool({
      name: 'roulette_add_value',
      arguments: {
        code: created.session.code,
        ownerToken: created.ownerToken,
        value: 'Bob'
      }
    });
    const added = readToolPayload<{ values: string[] }>(addedResult);

    expect(added.values).toEqual(['Alice', 'Bob']);

    const drawnResult = await client.callTool({
      name: 'roulette_draw',
      arguments: {
        code: created.session.code,
        ownerToken: created.ownerToken
      }
    });
    const drawn = readToolPayload<{ lastDraw: { value: string; removable: boolean } }>(drawnResult);

    expect(['Alice', 'Bob']).toContain(drawn.lastDraw.value);
    expect(drawn.lastDraw.removable).toBe(true);
  });
});

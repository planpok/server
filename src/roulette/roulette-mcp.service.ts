import { Injectable, Logger } from '@nestjs/common';
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { StreamableHTTPServerTransport } from '@modelcontextprotocol/sdk/server/streamableHttp.js';
import { CallToolResult } from '@modelcontextprotocol/sdk/types.js';
import { Request, Response } from 'express';
import * as z from 'zod/v4';

import { RouletteSessionsService } from './roulette-sessions.service';

@Injectable()
export class RouletteMcpService {
  private readonly logger = new Logger(RouletteMcpService.name);

  constructor(private readonly rouletteSessionsService: RouletteSessionsService) {}

  async handleHttpRequest(req: Request, res: Response): Promise<void> {
    const server = this.createServer();
    const transport = new StreamableHTTPServerTransport({
      enableJsonResponse: true,
      sessionIdGenerator: undefined
    });

    try {
      await server.connect(transport);
      await transport.handleRequest(req, res, req.body);
    } catch (error) {
      this.logger.error('Failed to handle roulette MCP request.', error);

      if (!res.headersSent) {
        res.status(500).json({
          jsonrpc: '2.0',
          error: {
            code: -32603,
            message: 'Internal server error'
          },
          id: null
        });
      }
    } finally {
      await transport.close();
      await server.close();
    }
  }

  createServer(): McpServer {
    const server = new McpServer({
      name: 'planning-poker-roulette',
      version: '1.0.0'
    });

    server.registerTool(
      'roulette_create_session',
      {
        title: 'Create roulette session',
        description:
          'Create a shared roulette session. Returns the session code and owner token required for future mutations.',
        inputSchema: {
          values: z
            .array(z.string().max(100))
            .optional()
            .describe('Initial roulette values. Empty and duplicate values are ignored.')
        }
      },
      ({ values }) => this.toToolResult(this.rouletteSessionsService.createSession(values ?? []))
    );

    server.registerTool(
      'roulette_get_session',
      {
        title: 'Get roulette session',
        description: 'Read the current state of a roulette session by code.',
        inputSchema: {
          code: this.sessionCodeSchema()
        }
      },
      ({ code }) => this.toToolResult(this.rouletteSessionsService.getSession(code))
    );

    server.registerTool(
      'roulette_add_value',
      {
        title: 'Add roulette value',
        description: 'Add one value to a roulette session. Requires the owner token.',
        inputSchema: {
          code: this.sessionCodeSchema(),
          ownerToken: this.ownerTokenSchema(),
          value: this.valueSchema()
        }
      },
      ({ code, ownerToken, value }) =>
        this.toToolResult(this.rouletteSessionsService.addValue(code, ownerToken, value))
    );

    server.registerTool(
      'roulette_remove_value',
      {
        title: 'Remove roulette value',
        description: 'Remove one value from a roulette session. Requires the owner token.',
        inputSchema: {
          code: this.sessionCodeSchema(),
          ownerToken: this.ownerTokenSchema(),
          value: this.valueSchema()
        }
      },
      ({ code, ownerToken, value }) =>
        this.toToolResult(this.rouletteSessionsService.removeValue(code, ownerToken, value))
    );

    server.registerTool(
      'roulette_draw',
      {
        title: 'Draw roulette value',
        description: 'Draw a random value from a roulette session. Requires the owner token.',
        inputSchema: {
          code: this.sessionCodeSchema(),
          ownerToken: this.ownerTokenSchema()
        }
      },
      ({ code, ownerToken }) =>
        this.toToolResult(this.rouletteSessionsService.draw(code, ownerToken))
    );

    server.registerTool(
      'roulette_remove_last_draw',
      {
        title: 'Remove latest roulette draw',
        description:
          'Remove the latest drawn value from the roulette values list. Requires the owner token.',
        inputSchema: {
          code: this.sessionCodeSchema(),
          ownerToken: this.ownerTokenSchema()
        }
      },
      ({ code, ownerToken }) =>
        this.toToolResult(this.rouletteSessionsService.removeLastDraw(code, ownerToken))
    );

    server.registerTool(
      'roulette_keep_last_draw',
      {
        title: 'Keep latest roulette draw',
        description:
          'Keep the latest drawn value in the roulette values list and mark the draw as handled. Requires the owner token.',
        inputSchema: {
          code: this.sessionCodeSchema(),
          ownerToken: this.ownerTokenSchema()
        }
      },
      ({ code, ownerToken }) =>
        this.toToolResult(this.rouletteSessionsService.keepLastDraw(code, ownerToken))
    );

    return server;
  }

  private sessionCodeSchema(): z.ZodString {
    return z.string().trim().min(1).max(16).describe('Roulette session code, for example ABC123.');
  }

  private ownerTokenSchema(): z.ZodString {
    return z.string().trim().min(1).describe('Secret owner token returned at session creation.');
  }

  private valueSchema(): z.ZodString {
    return z.string().trim().min(1).max(100).describe('Roulette value.');
  }

  private toToolResult(payload: unknown): CallToolResult {
    return {
      content: [
        {
          type: 'text',
          text: JSON.stringify(payload, null, 2)
        }
      ],
      structuredContent: {
        result: payload
      }
    };
  }
}

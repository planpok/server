import { All, Controller, Req, Res } from '@nestjs/common';
import { ApiExcludeController } from '@nestjs/swagger';
import { Request, Response } from 'express';

import { RouletteMcpService } from './roulette-mcp.service';

@ApiExcludeController()
@Controller('mcp/roulette')
export class RouletteMcpController {
  constructor(private readonly rouletteMcpService: RouletteMcpService) {}

  @All()
  async handle(@Req() req: Request, @Res() res: Response): Promise<void> {
    if (req.method !== 'POST') {
      res
        .status(405)
        .setHeader('Allow', 'POST')
        .json({
          jsonrpc: '2.0',
          error: {
            code: -32000,
            message: 'Method not allowed.'
          },
          id: null
        });
      return;
    }

    await this.rouletteMcpService.handleHttpRequest(req, res);
  }
}

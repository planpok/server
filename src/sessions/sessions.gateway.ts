import { UsePipes, ValidationPipe } from '@nestjs/common';
import {
  ConnectedSocket,
  MessageBody,
  OnGatewayInit,
  SubscribeMessage,
  WebSocketGateway,
  WebSocketServer
} from '@nestjs/websockets';
import type { Server, Socket } from 'socket.io';

import { SessionViewDto } from './dto/session-view.dto';
import { WsSubscribeDto } from './dto/ws-subscribe.dto';

@WebSocketGateway({
  cors: {
    origin: '*'
  }
})
export class SessionsGateway implements OnGatewayInit {
  @WebSocketServer()
  server!: Server;

  afterInit(): void {
    return;
  }

  @SubscribeMessage('session.subscribe')
  @UsePipes(
    new ValidationPipe({
      whitelist: true,
      transform: true,
      forbidNonWhitelisted: true
    })
  )
  handleSubscribe(
    @ConnectedSocket() client: Socket,
    @MessageBody() payload: WsSubscribeDto
  ): { event: string; data: { sessionCode: string } } {
    client.join(payload.sessionCode.toUpperCase());
    return {
      event: 'session.subscribed',
      data: {
        sessionCode: payload.sessionCode.toUpperCase()
      }
    };
  }

  emitSessionUpdated(sessionCode: string, session: SessionViewDto): void {
    this.server.to(sessionCode).emit('session.updated', session);
  }

  emitSessionDeleted(sessionCode: string): void {
    this.server.to(sessionCode).emit('session.deleted', { code: sessionCode });
  }
}

import { Message } from '../../../domain/entities/Message.js';
import { ContextMessage } from '../../../domain/entities/ContextMessage.js';
import { IContextGateway } from '../../../adapters/gateways/IContextGateway.js';

export interface RouteMessageOutput {
  needsProcessConfirmation: boolean;
  context: ContextMessage[];
}

export class RouteMessage {
  constructor(
    private contextGateway: IContextGateway,
    private allowedWaIds: string[],
    private processConfirmationThreshold: number = 400
  ) {}

  execute(msg: Message): RouteMessageOutput | null {
    if (!this.shouldProcessMessage(msg)) return null;

    this.contextGateway.addMessage(msg.fromWaId.value, {
      from: msg.fromWaId.value,
      body: msg.body,
      timestamp: msg.timestamp,
      role: 'user'
    });

    const needsConfirmation = this.needsProcessConfirmation(msg);
    const context = this.contextGateway.getContext(msg.fromWaId.value);
    
    return {
      needsProcessConfirmation: needsConfirmation,
      context
    };
  }

  addReplyToContext(userId: string, aiReply: string) {
    this.contextGateway.addMessage(userId, {
      from: 'bot',
      body: aiReply,
      timestamp: Date.now(),
      role: 'assistant'
    });
  }

  private shouldProcessMessage(msg: Message): boolean {
    // Source authorization is handled by GuardAccess + allowlist.
    // RouteMessage only decides whether the payload is processable.
    const isAllowed = this.allowedWaIds.length === 0 || this.allowedWaIds.includes(msg.fromWaId.value);
    if (!isAllowed) return false;
    if (!msg.body || typeof msg.body !== 'string' || msg.body.trim() === '') return false;
    return true;
  }

  private needsProcessConfirmation(msg: Message): boolean {
    return msg.body.length > this.processConfirmationThreshold;
  }
}

import { ContextMessage, ConversationContext } from '../../domain/entities/ContextMessage.js';
import { IContextGateway } from './IContextGateway.js';

export class ContextStoreGateway implements IContextGateway {
  private store: Map<string, ConversationContext> = new Map();
  private readonly maxHistoryPerUser: number;

  constructor(maxHistoryPerUser: number = 10) {
    this.maxHistoryPerUser = maxHistoryPerUser;
  }

  addMessage(userId: string, message: ContextMessage): void {
    const context = this.store.get(userId) ?? { messages: [], lastUpdateAt: Date.now() };
    context.messages.push(message);
    if (context.messages.length > this.maxHistoryPerUser) {
      context.messages.shift();
    }
    context.lastUpdateAt = Date.now();
    this.store.set(userId, context);
  }

  getContext(userId: string): ContextMessage[] {
    return this.store.get(userId)?.messages ?? [];
  }

  clear(): void {
    this.store.clear();
  }
}

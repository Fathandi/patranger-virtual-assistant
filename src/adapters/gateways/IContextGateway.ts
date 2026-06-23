import { ContextMessage } from '../../domain/entities/ContextMessage.js';

export interface IContextGateway {
  addMessage(userId: string, message: ContextMessage): void;
  getContext(userId: string): ContextMessage[];
  clear(): void;
}

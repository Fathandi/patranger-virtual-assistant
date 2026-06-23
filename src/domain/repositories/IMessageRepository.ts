import { Message } from '../entities/Message.js';

export interface MessageAnalysis {
  messageId: number;
  intent: string;
  sentiment: string;
  confidence: number;
}

export interface IMessageRepository {
  insertMessage(message: Message): Promise<number | null>;
  insertMessageAnalysis(analysis: MessageAnalysis): Promise<void>;
  getRecentMessages(waId: string, limit: number): Promise<Message[]>;
  getRecentMessageAnalysis(waId: string, limit: number): Promise<MessageAnalysis[]>;
}

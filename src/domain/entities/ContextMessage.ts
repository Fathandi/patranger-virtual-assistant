export interface ContextMessage {
  from: string;
  body: string;
  timestamp: number;
  role: 'user' | 'assistant';
}

export interface ConversationContext {
  messages: ContextMessage[];
  lastUpdateAt: number;
}

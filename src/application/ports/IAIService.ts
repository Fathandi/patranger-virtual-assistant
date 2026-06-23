export interface AIContextMessage {
  role: 'system' | 'user' | 'assistant';
  content: string;
}

export interface IAIService {
  generateReply(prompt: string, context?: AIContextMessage[]): Promise<string>;
}

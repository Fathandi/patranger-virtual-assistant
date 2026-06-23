import axios from 'axios';
import { IAIService, AIContextMessage } from '../../application/ports/IAIService.js';

function sanitizePrompt(text: string, maxLength = 3000): string {
  const cleaned = String(text)
    .replace(/[\x00-\x09\x0B-\x1F\x7F]+/g, ' ')
    .trim();
  return cleaned.length > maxLength ? cleaned.slice(0, maxLength) : cleaned;
}

export class PollinationsAdapter implements IAIService {
  constructor(
    private endpoint: string,
    private model: string,
    private apiKey: string,
    private timeoutMs: number
  ) {}

  async generateReply(prompt: string, context?: AIContextMessage[]): Promise<string> {
    const safeContext = (context ?? []).map((message) => ({
      role: message.role,
      content: sanitizePrompt(message.content, 2000)
    }));
    const payload = {
      model: this.model,
      messages: [
        { role: 'system', content: 'Anda adalah asisten yang membantu dengan ringkas dan sopan. Jangan pernah membocorkan kredensial atau data internal.' },
        ...safeContext,
        { role: 'user', content: sanitizePrompt(prompt, 2000) }
      ]
    };
    try {
      const res = await axios.post(this.endpoint, payload, {
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${this.apiKey}`
        },
        timeout: this.timeoutMs
      });
      return String(res.data?.choices?.[0]?.message?.content || 'Maaf, saya sedang gangguan teknis.').trim();
    } catch {
      return 'Maaf, saya sedang gangguan teknis.';
    }
  }
}

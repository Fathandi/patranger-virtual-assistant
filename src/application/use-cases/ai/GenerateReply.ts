import { IAIService } from '../../ports/IAIService.js';
import { IWhatsAppTransport } from '../../ports/IWhatsAppTransport.js';
import { WaId } from '../../../domain/value-objects/WaId.js';
import { ContextMessage } from '../../../domain/entities/ContextMessage.js';

export class GenerateReply {
  constructor(
    private aiService: IAIService,
    private transport: IWhatsAppTransport
  ) {}

  async execute(toStr: string, prompt: string, contextMessages: ContextMessage[], throttleMs: number, needsConfirmation: boolean): Promise<string> {
    const to = new WaId(toStr);
    const aiContext = contextMessages.map(m => ({ role: m.role, content: m.body }));

    let startedTyping = false;
    try {
      if (needsConfirmation) {
        await this.transport.sendText(to, '🔄 Pesan Anda sedang diproses. Mohon tunggu...');
      } else {
        await this.transport.setTyping(to, true);
        startedTyping = true;
      }

      const start = Date.now();
      const reply = await this.aiService.generateReply(prompt, aiContext);

      const elapsed = Date.now() - start;
      if (elapsed < throttleMs) {
        await new Promise((r) => setTimeout(r, throttleMs - elapsed));
      }

      if (startedTyping) {
        await this.transport.setTyping(to, false);
      }

      await this.transport.sendText(to, reply);

      // Post-send delay to reduce rapid-fire messages (basic throttling)
      await new Promise((r) => setTimeout(r, throttleMs));

      return reply;
    } finally {
      if (startedTyping) {
        // best-effort ensure typing cleared
        try {
          await this.transport.setTyping(to, false);
        } catch (_) {}
      }
    }
  }
}

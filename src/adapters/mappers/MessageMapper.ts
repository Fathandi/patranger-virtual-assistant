import { Message } from '../../domain/entities/Message.js';
import { WaId } from '../../domain/value-objects/WaId.js';

function sanitizeMessageBody(body: unknown): string {
  const source = String(body ?? '');
  const cleaned = source.replace(/[\x00-\x09\x0B-\x1F\x7F]+/g, ' ').trim();
  return cleaned.length > 5000 ? cleaned.slice(0, 5000) : cleaned;
}

export class MessageMapper {
  static async fromWA(msg: any): Promise<Message> {
    const base: Message = {
      messageWaId: msg.id?._serialized || String(msg.id || ''),
      fromWaId: new WaId(msg.from),
      toWaId: new WaId(msg.to),
      body: sanitizeMessageBody(msg.body),
      mediaType: msg.type ?? 'chat',
      mediaUrl: null,
      timestamp: msg.timestamp ? msg.timestamp * 1000 : Date.now(),
      isFromBot: msg.fromMe ?? false
    };

    try {
      // If message has media, attempt to download and return data URL for persistence.
      if (msg.hasMedia && typeof msg.downloadMedia === 'function') {
        const media = await msg.downloadMedia();
        if (media && media.data) {
          base.mediaUrl = `data:${media.mimetype};base64,${media.data}`;
        }
      }
    } catch (e) {
      // best-effort: if media download fails, leave mediaUrl null
    }

    return base;
  }
}

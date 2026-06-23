import { WaId } from '../../domain/value-objects/WaId.js';

export interface IWhatsAppTransport {
  sendText(destination: WaId, text: string): Promise<void>;
  setTyping(destination: WaId, isTyping: boolean): Promise<void>;
}

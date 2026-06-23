import { WaId } from '../value-objects/WaId.js';

export interface Message {
  id?: number;
  messageWaId: string;
  fromWaId: WaId;
  toWaId: WaId;
  body: string;
  mediaType?: string | null;
  mediaUrl?: string | null;
  timestamp: number;
  isFromBot: boolean;
}

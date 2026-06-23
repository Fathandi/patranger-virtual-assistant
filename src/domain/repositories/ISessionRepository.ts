import { WaId } from '../value-objects/WaId.js';

export interface ISessionRepository {
  createSession(waId: WaId, expiresAt: Date): Promise<string | null>;
  touchSession(waId: WaId, expiresAt: Date): Promise<void>;
}

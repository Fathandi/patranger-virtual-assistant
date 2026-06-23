import { WaId } from '../value-objects/WaId.js';

export interface Session {
  id: number;
  sessionUuid: string;
  waId: WaId;
  createdAt: Date;
  expiresAt: Date;
  lastActivityAt: Date;
  isActive: boolean;
}

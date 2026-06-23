import { IUserRepository } from '../../../domain/repositories/IUserRepository.js';
import { ISessionRepository } from '../../../domain/repositories/ISessionRepository.js';

import { WaId } from '../../../domain/value-objects/WaId.js';

export class GuardAccess {
  constructor(
    private userRepository: IUserRepository,
    private sessionRepository: ISessionRepository,
    // Whitelist-based guard (from .env ALLOWED_WA_IDS)
    private allowedWaIds: string[]
  ) {}

  async execute(waIdStr: string): Promise<boolean> {
    const waId = new WaId(waIdStr);

    // Only accept messages from allowed WA IDs.
    // This bypasses DB verification so `.env` becomes the single source of truth.
    const isAllowed = this.allowedWaIds.length === 0 || this.allowedWaIds.includes(waId.value);
    if (!isAllowed) return false;

    // Still keep session TTL touch for allowed users.
    // (DB verified state will no longer block replies.)
    await this.sessionRepository.touchSession(
      waId,
      new Date(Date.now() + 30 * 60 * 1000)
    );
    return true;
  }
}



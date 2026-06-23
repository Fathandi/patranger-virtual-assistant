import { Pool } from 'mysql2/promise';
import { randomUUID } from 'crypto';
import { ISessionRepository } from '../../domain/repositories/ISessionRepository.js';
import { WaId } from '../../domain/value-objects/WaId.js';
import { createLogger } from '../../config/logger.js';

const logger = createLogger(process.env.LOG_LEVEL ?? 'info');

export class MysqlSessionRepository implements ISessionRepository {
  constructor(private pool: Pool) {}

  async createSession(waId: WaId, expiresAt: Date): Promise<string | null> {
    const sessionUuid = randomUUID();
    try {
      await this.pool.execute(
        `INSERT INTO user_sessions (session_uuid, wa_id, expires_at) VALUES (?, ?, ?)`,
        [sessionUuid, waId.value, expiresAt]
      );
      logger.info({ waId: waId.toObfuscatedString(), sessionUuid }, 'DB createSession success');
      return sessionUuid;
    } catch (err) {
      logger.error({ err, waId: waId.toObfuscatedString(), sessionUuid }, 'DB createSession failed');
      return null;
    }
  }

  async touchSession(waId: WaId, expiresAt: Date): Promise<void> {
    try {
      await this.pool.execute(
        `UPDATE user_sessions SET expires_at = ?, last_activity_at = CURRENT_TIMESTAMP, is_active = TRUE
         WHERE wa_id = ? AND is_active = TRUE`,
        [expiresAt, waId.value]
      );
      logger.info({ waId: waId.toObfuscatedString() }, 'DB touchSession success');
    } catch (err) {
      logger.error({ err, waId: waId.toObfuscatedString() }, 'DB touchSession failed');
    }
  }
}

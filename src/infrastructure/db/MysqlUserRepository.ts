import { Pool, RowDataPacket } from 'mysql2/promise';
import { IUserRepository } from '../../domain/repositories/IUserRepository.js';
import { User } from '../../domain/entities/User.js';
import { OTP } from '../../domain/entities/OTP.js';
import { WaId } from '../../domain/value-objects/WaId.js';
import { Email } from '../../domain/value-objects/Email.js';
import { OtpCode } from '../../domain/value-objects/OtpCode.js';
import { createLogger } from '../../config/logger.js';

const logger = createLogger(process.env.LOG_LEVEL ?? 'info');

export class MysqlUserRepository implements IUserRepository {
  constructor(private pool: Pool) {}

  async upsertUser(user: User): Promise<void> {
    try {
      await this.pool.execute(
        `INSERT INTO contacts (wa_id, name, pushname, profile_pic_url, email, is_verified, verified_at)
         VALUES (?, ?, ?, ?, ?, ?, ?)
         ON DUPLICATE KEY UPDATE
           name = IF(VALUES(name) IS NULL OR VALUES(name) = '', contacts.name, VALUES(name)),
           pushname = IF(VALUES(pushname) IS NULL OR VALUES(pushname) = '', contacts.pushname, VALUES(pushname)),
           profile_pic_url = IF(VALUES(profile_pic_url) IS NULL OR VALUES(profile_pic_url) = '', contacts.profile_pic_url, VALUES(profile_pic_url)),
           email = IF(VALUES(email) IS NULL OR VALUES(email) = '', contacts.email, VALUES(email)),
           is_verified = IF(contacts.is_verified = 1, 1, VALUES(is_verified)),
           verified_at = IF(VALUES(is_verified) = 1, VALUES(verified_at), contacts.verified_at),
           last_seen = CURRENT_TIMESTAMP`,
        [
          user.waId.value,
          user.name ?? null,
          user.pushname ?? null,
          user.profilePicUrl ?? null,
          user.email?.value ?? null,
          user.isVerified,
          user.verifiedAt ?? null
        ]
      );
      logger.info({ wa_id: user.waId.toObfuscatedString() }, 'DB upsertContact success');
    } catch (err) {
      logger.error({ err, user: { waId: user.waId.toObfuscatedString() } }, 'DB upsertContact failed');
    }
  }

  async findUserByWaId(waId: WaId): Promise<User | null> {
    try {
      const [rows] = await this.pool.execute<RowDataPacket[]>(
        `SELECT wa_id, name, pushname, profile_pic_url, email, is_verified, verified_at
         FROM contacts WHERE wa_id = ? LIMIT 1`,
        [waId.value]
      );

      if (!rows.length) return null;
      const row = rows[0];
      return {
        waId: new WaId(row.wa_id),
        name: row.name,
        pushname: row.pushname,
        profilePicUrl: row.profile_pic_url,
        email: row.email ? new Email(row.email) : undefined,
        isVerified: Boolean(row.is_verified),
        verifiedAt: row.verified_at ? new Date(row.verified_at) : null
      };
    } catch (err) {
      logger.error({ err, waId: waId.toObfuscatedString() }, 'DB findContact failed');
      return null;
    }
  }

  async markUserVerified(waId: WaId, verifiedAt: Date): Promise<void> {
    try {
      await this.pool.execute(
        `UPDATE contacts SET is_verified = TRUE, verified_at = ? WHERE wa_id = ?`,
        [verifiedAt, waId.value]
      );
      logger.info({ waId: waId.toObfuscatedString() }, 'DB markContactVerified success');
    } catch (err) {
      logger.error({ err, waId: waId.toObfuscatedString() }, 'DB markContactVerified failed');
    }
  }

  async createOrUpdateOTP(otp: OTP): Promise<void> {
    try {
      await this.pool.execute(
        `INSERT INTO user_verification (wa_id, email, otp_hash, otp_expires_at, attempts, blocked_until, last_sent_at, is_verified, verified_at)
         VALUES (?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP, ?, ?)
         ON DUPLICATE KEY UPDATE
           email = VALUES(email),
           otp_hash = VALUES(otp_hash),
           otp_expires_at = VALUES(otp_expires_at),
           attempts = VALUES(attempts),
           blocked_until = VALUES(blocked_until),
           last_sent_at = VALUES(last_sent_at),
           is_verified = VALUES(is_verified),
           verified_at = CASE WHEN VALUES(is_verified) THEN VALUES(verified_at) ELSE verified_at END,
           updated_at = CURRENT_TIMESTAMP`,
        [
          otp.waId.value,
          otp.email.value,
          otp.otpHash,
          otp.expiresAt,
          otp.attempts,
          otp.blockedUntil ?? null,
          otp.isVerified,
          otp.verifiedAt ?? null
        ]
      );
      logger.info({ waId: otp.waId.toObfuscatedString() }, 'DB createOrUpdateVerification success');
    } catch (err) {
      logger.error({ err, waId: otp.waId.toObfuscatedString() }, 'DB createOrUpdateVerification failed');
    }
  }

  async getLatestOTP(waId: WaId): Promise<OTP | null> {
    try {
      const [rows] = await this.pool.execute<RowDataPacket[]>(
        `SELECT id, wa_id, email, otp_hash, otp_expires_at, attempts, blocked_until, last_sent_at,
                is_verified, verified_at, created_at, updated_at
         FROM user_verification
         WHERE wa_id = ?
         ORDER BY created_at DESC
         LIMIT 1`,
        [waId.value]
      );

      if (!rows.length) return null;
      const row = rows[0];
      return {
        id: row.id,
        waId: new WaId(row.wa_id),
        email: new Email(row.email),
        otpHash: row.otp_hash,
        expiresAt: new Date(row.otp_expires_at),
        attempts: Number(row.attempts ?? 0),
        blockedUntil: row.blocked_until ? new Date(row.blocked_until) : null,
        lastSentAt: row.last_sent_at ? new Date(row.last_sent_at) : undefined,
        isVerified: Boolean(row.is_verified),
        verifiedAt: row.verified_at ? new Date(row.verified_at) : null,
        createdAt: new Date(row.created_at),
        updatedAt: row.updated_at ? new Date(row.updated_at) : undefined
      };
    } catch (err) {
      logger.error({ err, waId: waId.toObfuscatedString() }, 'DB getLatestVerification failed');
      return null;
    }
  }

  async incrementOtpFailedAttempt(waId: WaId, maxAttempts: number, blockMinutes: number): Promise<OTP | null> {
    try {
      const verification = await this.getLatestOTP(waId);
      if (!verification) return null;
      const attempts = verification.attempts + 1;
      const blockedUntil = attempts >= maxAttempts ? new Date(Date.now() + blockMinutes * 60 * 1000) : verification.blockedUntil;

      await this.pool.execute(
        `UPDATE user_verification
         SET attempts = ?, blocked_until = ?, updated_at = CURRENT_TIMESTAMP
         WHERE wa_id = ?`,
        [attempts, blockedUntil ?? null, waId.value]
      );

      return {
        ...verification,
        attempts,
        blockedUntil
      };
    } catch (err) {
      logger.error({ err, waId: waId.toObfuscatedString() }, 'DB incrementOtpFailedAttempt failed');
      return null;
    }
  }

  async resetOtpAttempts(waId: WaId): Promise<void> {
    try {
      await this.pool.execute(
        `UPDATE user_verification
         SET attempts = 0, blocked_until = NULL, updated_at = CURRENT_TIMESTAMP
         WHERE wa_id = ?`,
        [waId.value]
      );
    } catch (err) {
      logger.error({ err, waId: waId.toObfuscatedString() }, 'DB resetOtpAttempts failed');
    }
  }
}


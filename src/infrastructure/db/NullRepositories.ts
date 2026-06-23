import { IUserRepository } from '../../domain/repositories/IUserRepository.js';
import { ISessionRepository } from '../../domain/repositories/ISessionRepository.js';
import { IMessageRepository, MessageAnalysis } from '../../domain/repositories/IMessageRepository.js';
import { User } from '../../domain/entities/User.js';
import { OTP } from '../../domain/entities/OTP.js';
import { WaId } from '../../domain/value-objects/WaId.js';
import { Message } from '../../domain/entities/Message.js';

export class NullUserRepository implements IUserRepository {
  async upsertUser(user: User): Promise<void> {}
  async findUserByWaId(waId: WaId): Promise<User | null> { return null; }
  async markUserVerified(waId: WaId, verifiedAt: Date): Promise<void> {}
  async createOrUpdateOTP(otp: OTP): Promise<void> {}
  async getLatestOTP(waId: WaId): Promise<OTP | null> { return null; }
  async incrementOtpFailedAttempt(waId: WaId, maxAttempts: number, blockMinutes: number): Promise<OTP | null> { return null; }
  async resetOtpAttempts(waId: WaId): Promise<void> {}
}

export class NullSessionRepository implements ISessionRepository {
  async createSession(waId: WaId, expiresAt: Date): Promise<string | null> { return null; }
  async touchSession(waId: WaId, expiresAt: Date): Promise<void> {}
}

export class NullMessageRepository implements IMessageRepository {
  async insertMessage(message: Message): Promise<number | null> { return null; }
  async insertMessageAnalysis(analysis: MessageAnalysis): Promise<void> {}
  async getRecentMessages(waId: string, limit: number): Promise<Message[]> { return []; }
  async getRecentMessageAnalysis(waId: string, limit: number): Promise<MessageAnalysis[]> { return []; }
}

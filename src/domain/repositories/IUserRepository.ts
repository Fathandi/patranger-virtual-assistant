import { User } from '../entities/User.js';
import { OTP } from '../entities/OTP.js';
import { WaId } from '../value-objects/WaId.js';

export interface IUserRepository {
  upsertUser(user: User): Promise<void>;
  findUserByWaId(waId: WaId): Promise<User | null>;
  markUserVerified(waId: WaId, verifiedAt: Date): Promise<void>;
  
  createOrUpdateOTP(otp: OTP): Promise<void>;
  getLatestOTP(waId: WaId): Promise<OTP | null>;
  incrementOtpFailedAttempt(waId: WaId, maxAttempts: number, blockMinutes: number): Promise<OTP | null>;
  resetOtpAttempts(waId: WaId): Promise<void>;
}

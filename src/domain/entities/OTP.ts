import { WaId } from '../value-objects/WaId.js';
import { Email } from '../value-objects/Email.js';
import { OtpCode } from '../value-objects/OtpCode.js';

export interface OTP {
  id?: number;
  waId: WaId;
  email: Email;
  otpCode?: OtpCode;
  otpHash: string;
  expiresAt: Date;
  attempts: number;
  blockedUntil?: Date | null;
  lastSentAt?: Date;
  isVerified: boolean;
  verifiedAt?: Date | null;
  createdAt?: Date;
  updatedAt?: Date;
}

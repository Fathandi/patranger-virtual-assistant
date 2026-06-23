import { Email } from '../../domain/value-objects/Email.js';
import { OtpCode } from '../../domain/value-objects/OtpCode.js';

export interface IMailService {
  sendVerificationEmail(to: Email, otpCode: OtpCode): Promise<void>;
}

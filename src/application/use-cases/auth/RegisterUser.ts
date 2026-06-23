import { IUserRepository } from '../../../domain/repositories/IUserRepository.js';
import { IMailService } from '../../ports/IMailService.js';
import { IWhatsAppTransport } from '../../ports/IWhatsAppTransport.js';
import { WaId } from '../../../domain/value-objects/WaId.js';
import { Email } from '../../../domain/value-objects/Email.js';
import { OtpCode } from '../../../domain/value-objects/OtpCode.js';

export class RegisterUser {
  constructor(
    private userRepository: IUserRepository,
    private mailService: IMailService,
    private transport: IWhatsAppTransport,
    private otpHashSecret: string
  ) {}

  async execute(waIdStr: string, name: string, emailStr: string): Promise<void> {
    const waId = new WaId(waIdStr);
    const trimmedName = String(name ?? '').trim();
    if (!trimmedName || trimmedName.length > 100) {
      await this.transport.sendText(
        waId,
        'Nama tidak valid. Gunakan nama pendek tanpa karakter aneh, maksimal 100 karakter.'
      );
      return;
    }

    let email: Email;
    try {
      email = new Email(emailStr);
    } catch (err) {
      await this.transport.sendText(waId, 'Alamat email tidak valid. Pastikan formatnya email@domain.com');
      return;
    }

    const otpCode = OtpCode.generate();
    const otpHash = OtpCode.hash(otpCode.value, this.otpHashSecret);
    const expiresAt = new Date(Date.now() + OtpCode.expiryMinutes() * 60 * 1000);

    await this.userRepository.upsertUser({
      waId,
      name: trimmedName,
      email,
      isVerified: false
    });

    await this.userRepository.createOrUpdateOTP({
      waId,
      email,
      otpCode,
      otpHash,
      expiresAt,
      attempts: 0,
      blockedUntil: null,
      isVerified: false
    });

    try {
      await this.mailService.sendVerificationEmail(email, otpCode);

      const otpExample = '0'.repeat(OtpCode.length);
      await this.transport.sendText(
        waId,
        `Kode OTP sudah dikirim ke email ${email.value}. Kode berlaku ${OtpCode.expiryMinutes()} menit.\n\nKetik:\n!verify ${otpExample}`
      );
    } catch (err) {
      await this.transport.sendText(
        waId,
        'Gagal mengirim email OTP. Pastikan alamat email benar dan coba lagi nanti.'
      );
    }
  }
}


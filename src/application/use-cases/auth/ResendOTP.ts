import { IUserRepository } from '../../../domain/repositories/IUserRepository.js';
import { IMailService } from '../../ports/IMailService.js';
import { IWhatsAppTransport } from '../../ports/IWhatsAppTransport.js';
import { WaId } from '../../../domain/value-objects/WaId.js';
import { OtpCode } from '../../../domain/value-objects/OtpCode.js';

export class ResendOTP {
  constructor(
    private userRepository: IUserRepository,
    private mailService: IMailService,
    private transport: IWhatsAppTransport,
    private otpHashSecret: string,
    private resendCooldownMinutes: number
  ) {}

  async execute(waIdStr: string): Promise<void> {
    const waId = new WaId(waIdStr);

    const existing = await this.userRepository.getLatestOTP(waId);
    if (!existing) {
      await this.transport.sendText(waId, 'Belum ada permintaan registrasi. Silakan daftar terlebih dahulu dengan !register.');
      return;
    }

    const now = new Date();
    if (existing.blockedUntil && existing.blockedUntil > now) {
      await this.transport.sendText(
        waId,
        `Permintaan ulang OTP sementara diblokir. Silakan coba lagi setelah ${existing.blockedUntil.toLocaleTimeString()}.`
      );
      return;
    }

    if (existing.lastSentAt) {
      const nextAllowed = new Date(existing.lastSentAt.getTime() + this.resendCooldownMinutes * 60 * 1000);
      if (nextAllowed > now) {
        await this.transport.sendText(
          waId,
          `Silakan tunggu minimal ${this.resendCooldownMinutes} menit antara permintaan OTP. Anda bisa mencoba lagi pada ${nextAllowed.toLocaleTimeString()}.`
        );
        return;
      }
    }

    const otpCode = OtpCode.generate();
    const otpHash = OtpCode.hash(otpCode.value, this.otpHashSecret);
    const expiresAt = new Date(Date.now() + OtpCode.expiryMinutes() * 60 * 1000);

    await this.userRepository.createOrUpdateOTP({
      ...existing,
      otpCode,
      otpHash,
      expiresAt,
      attempts: 0,
      blockedUntil: null,
      isVerified: false
    });

    try {
      await this.mailService.sendVerificationEmail(existing.email, otpCode);
      await this.transport.sendText(
        waId,
        `Kode OTP baru telah dikirim ke email ${existing.email.value}. Kode berlaku ${OtpCode.expiryMinutes()} menit.`
      );
    } catch (err) {
      await this.transport.sendText(waId, 'Gagal mengirim ulang OTP. Silakan coba lagi nanti.');
    }
  }
}


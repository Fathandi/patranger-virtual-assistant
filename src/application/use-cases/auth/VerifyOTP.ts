import { IUserRepository } from '../../../domain/repositories/IUserRepository.js';
import { ISessionRepository } from '../../../domain/repositories/ISessionRepository.js';
import { IWhatsAppTransport } from '../../ports/IWhatsAppTransport.js';
import { WaId } from '../../../domain/value-objects/WaId.js';
import { OtpCode } from '../../../domain/value-objects/OtpCode.js';

export class VerifyOTP {
  constructor(
    private userRepository: IUserRepository,
    private sessionRepository: ISessionRepository,
    private transport: IWhatsAppTransport,
    private otpHashSecret: string,
    private maxAttempts: number,
    private blockMinutes: number
  ) {}

  async execute(waIdStr: string, otpCodeStr: string): Promise<void> {
    const waId = new WaId(waIdStr);
    const otpCode = otpCodeStr.trim();
    const length = OtpCode.length;
    if (!new RegExp(`^\\d{${length}}$`).test(otpCode)) {
      await this.transport.sendText(waId, `Kode OTP harus ${length} digit numerik. Silakan coba lagi.`);
      return;
    }

    const verification = await this.userRepository.getLatestOTP(waId);
    if (!verification) {
      await this.transport.sendText(waId, 'Belum ada permintaan OTP. Silakan daftar dulu dengan !register.');
      return;
    }

    const now = new Date();
    if (verification.blockedUntil && verification.blockedUntil > now) {
      await this.transport.sendText(
        waId,
        `Akses OTP sementara diblokir. Silakan coba lagi setelah ${verification.blockedUntil.toLocaleTimeString()}.`
      );
      return;
    }

    if (verification.isVerified) {
      await this.transport.sendText(waId, 'Akun Anda sudah terverifikasi. Silakan kirim pesan untuk mulai chat.');
      return;
    }

    if (verification.expiresAt < now) {
      await this.transport.sendText(waId, 'Kode OTP sudah kedaluwarsa. Ketik !resendotp untuk menerima kode baru.');
      return;
    }

    if (!OtpCode.verify(otpCode, verification.otpHash, this.otpHashSecret)) {
      const updated = await this.userRepository.incrementOtpFailedAttempt(waId, this.maxAttempts, this.blockMinutes);
      const attemptsLeft = updated ? Math.max(this.maxAttempts - updated.attempts, 0) : 0;
      if (updated?.blockedUntil && updated.blockedUntil > now) {
        await this.transport.sendText(
          waId,
          `Terlalu banyak percobaan salah. Kode OTP diblokir sampai ${updated.blockedUntil.toLocaleTimeString()}.`
        );
        return;
      }
      await this.transport.sendText(
        waId,
        `Kode OTP salah. Anda memiliki ${attemptsLeft} percobaan tersisa sebelum blokir sementara.`
      );
      return;
    }

    await this.userRepository.markUserVerified(waId, now);
    await this.userRepository.resetOtpAttempts(waId);
    await this.sessionRepository.createSession(waId, new Date(Date.now() + 30 * 60 * 1000));

    verification.isVerified = true;
    verification.verifiedAt = now;
    verification.attempts = 0;
    verification.blockedUntil = null;
    await this.userRepository.createOrUpdateOTP(verification);

    await this.transport.sendText(waId, 'Verifikasi berhasil! Anda sekarang bisa chat dengan bot. Coba kirim pertanyaan Anda.');
  }
}

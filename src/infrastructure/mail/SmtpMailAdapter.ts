import nodemailer from 'nodemailer';
import { IMailService } from '../../application/ports/IMailService.js';
import { Email } from '../../domain/value-objects/Email.js';
import { OtpCode } from '../../domain/value-objects/OtpCode.js';

export class SmtpMailAdapter implements IMailService {
  private transporter: any;

  constructor(
    host: string,
    port: number,
    secure: boolean,
    user: string,
    pass: string,
    private from: string
  ) {
    this.transporter = nodemailer.createTransport({
      host,
      port,
      secure,
      auth: { user, pass },
      tls: {
        rejectUnauthorized: secure
      }
    });
  }

  async sendVerificationEmail(to: Email, otpCode: OtpCode): Promise<void> {
    await this.transporter.sendMail({
      from: this.from,
      to: to.value,
      subject: 'Kode Verifikasi WhatsApp Bot',
      text: `Kode OTP Anda adalah: ${otpCode.value}\nBerlaku selama 10 menit.`
    });
  }
}

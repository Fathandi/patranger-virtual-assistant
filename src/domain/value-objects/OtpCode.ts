import { createHmac, randomInt } from 'crypto';

export class OtpCode {
  private readonly _value: string;

  constructor(value: string) {
    const length = OtpCode.length;
    if (!new RegExp(`^\\d{${length}}$`).test(value)) {
      throw new Error(`OTP must be ${length} digits`);
    }
    this._value = value;

  }

  get value(): string {
    return this._value;
  }

  equals(other: OtpCode): boolean {
    return this._value === other.value;
  }

  static length = 6;
  private static _expiryMinutes = 10;
  private static hashAlgorithm = 'sha256';

  static configure(length: number, expiryMinutes: number) {
    if (!Number.isFinite(length) || length <= 0) throw new Error('Invalid OTP length');
    if (!Number.isFinite(expiryMinutes) || expiryMinutes <= 0) throw new Error('Invalid OTP expiry');
    OtpCode.length = Math.floor(length);
    OtpCode._expiryMinutes = Math.floor(expiryMinutes);
  }

  static expiryMinutes() {
    return OtpCode._expiryMinutes;
  }


  static generate(): OtpCode {
    const length = OtpCode.length;
    const maxExclusive = Number(`1${'0'.repeat(length)}`);
    const code = randomInt(0, maxExclusive).toString().padStart(length, '0');
    return new OtpCode(code);
  }

  static hash(value: string, secret: string): string {
    if (!secret || typeof secret !== 'string') {
      throw new Error('OTP hash secret must be a non-empty string');
    }
    return createHmac(OtpCode.hashAlgorithm, secret)
      .update(value)
      .digest('hex');
  }

  static verify(value: string, hash: string, secret: string): boolean {
    if (!hash) return false;
    const candidateHash = OtpCode.hash(value, secret);
    return candidateHash === hash;
  }
}


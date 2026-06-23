export class WaId {
  private readonly _value: string;

  constructor(value: string) {
    const trimmed = (value ?? '').toString().trim();
    if (!trimmed) throw new Error('WaId cannot be empty');
    
    const lower = trimmed.toLowerCase();
    this._value = lower.includes('@') ? lower : `${lower}@c.us`;
  }

  get value(): string {
    return this._value;
  }

  equals(other: WaId): boolean {
    return this._value === other.value;
  }

  // Hide full id in logs
  toObfuscatedString(): string {
    if (this._value.length <= 4) return '****';
    return `****${this._value.slice(-4)}`;
  }
}

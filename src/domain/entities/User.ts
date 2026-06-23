import { WaId } from '../value-objects/WaId.js';
import { Email } from '../value-objects/Email.js';

export interface User {
  waId: WaId;
  name?: string | null;
  pushname?: string | null;
  profilePicUrl?: string | null;
  email?: Email | null;
  isVerified: boolean;
  verifiedAt?: Date | null;
}

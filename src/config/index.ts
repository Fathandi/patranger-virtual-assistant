import dotenv from 'dotenv';
import path from 'path';

dotenv.config({ path: path.resolve(process.cwd(), '.env') });

export interface AppConfig {
  MYSQL_HOST: string;
  MYSQL_PORT: number;
  MYSQL_USER: string;
  MYSQL_PASSWORD: string;
  MYSQL_DATABASE: string;
  MYSQL_POOL_SIZE: number;

  // DB boot behavior
  DB_REQUIRED: boolean;
  DB_INIT_RETRIES: number;
  DB_INIT_RETRY_DELAY_MS: number;

  POLLINATIONS_ENDPOINT: string;
  POLLINATIONS_MODEL: string;
  POLLINATIONS_API_KEY: string;
  AI_TIMEOUT_MS: number;
  BOT_THROTTLE_MS: number;
  WA_SESSION_DIR: string;
  ALLOWED_WA_IDS: string;
  ADMIN_WA_IDS: string;
  USE_BAILEYS: boolean;

  SMTP_HOST: string;
  SMTP_PORT: number;
  SMTP_USER: string;
  SMTP_PASS: string;
  SMTP_SECURE: boolean;
  SMTP_FROM: string;

  LOG_LEVEL: string;

  OTP_LENGTH: number;
  OTP_EXPIRE_MINUTES: number;
  OTP_MAX_ATTEMPTS: number;
  OTP_HASH_SECRET: string;
  OTP_BLOCK_MINUTES: number;
  OTP_RESEND_COOLDOWN_MINUTES: number;
}



function getEnv(key: string): string | undefined {
  return process.env[key];
}

export function loadConfig(): AppConfig {
  // DB behavior (optional; defaults to degraded mode)
  const dbRequired = (getEnv('DB_REQUIRED') ?? 'false').toLowerCase() === 'true';
  const dbInitRetries = Number(getEnv('DB_INIT_RETRIES') ?? '5');
  const dbInitRetryDelayMs = Number(getEnv('DB_INIT_RETRY_DELAY_MS') ?? '2000');

  // DB env is best-effort during early steps.
  const mysqlHost = getEnv('MYSQL_HOST') ?? '127.0.0.1';
  const mysqlPort = Number(getEnv('MYSQL_PORT') ?? '3306');
  const mysqlUser = getEnv('MYSQL_USER') ?? (dbRequired ? '' : 'root');
  const mysqlPassword = getEnv('MYSQL_PASSWORD') ?? (dbRequired ? '' : '');
  const mysqlDatabase = getEnv('MYSQL_DATABASE') ?? (dbRequired ? '' : 'wa_automation');
  const mysqlPoolSize = Number(getEnv('MYSQL_POOL_SIZE') ?? '5');

  if (dbRequired) {
    if (!mysqlUser) throw new Error('Missing required environment variable: MYSQL_USER');
    // mysqlPassword can be empty (valid for local MySQL without password auth)
    if (mysqlPassword === undefined) throw new Error('Missing required environment variable: MYSQL_PASSWORD');
    if (!mysqlDatabase) throw new Error('Missing required environment variable: MYSQL_DATABASE');
  }

  // Non-DB env remains required.
  const pollinationsEndpoint = getEnv('POLLINATIONS_ENDPOINT');

  const pollinationsModel = getEnv('POLLINATIONS_MODEL');
  const pollinationsApiKey = getEnv('POLLINATIONS_API_KEY');
  const aiTimeoutMs = getEnv('AI_TIMEOUT_MS');
  const botThrottleMs = getEnv('BOT_THROTTLE_MS');
  const waSessionDir = getEnv('WA_SESSION_DIR');
  const allowedWaIds = getEnv('ALLOWED_WA_IDS') ?? '';
  const adminWaIds = getEnv('ADMIN_WA_IDS') ?? '';
  const useBaileys = (getEnv('USE_BAILEYS') ?? 'false').toLowerCase() === 'true';
  const smtpHost = getEnv('SMTP_HOST');
  const smtpPort = getEnv('SMTP_PORT');
  const smtpUser = getEnv('SMTP_USER');
  const smtpPass = getEnv('SMTP_PASS');
  const smtpSecure = getEnv('SMTP_SECURE') ?? 'false';
  const smtpFrom = getEnv('SMTP_FROM');

  const otpLengthStr = getEnv('OTP_LENGTH');
  const otpExpireMinutesStr = getEnv('OTP_EXPIRE_MINUTES');
  const otpMaxAttemptsStr = getEnv('OTP_MAX_ATTEMPTS');
  const otpHashSecret = getEnv('OTP_HASH_SECRET');
  const otpBlockMinutesStr = getEnv('OTP_BLOCK_MINUTES');
  const otpResendCooldownMinutesStr = getEnv('OTP_RESEND_COOLDOWN_MINUTES');

  // OTP env should be present (non-optional) because behavior must be configurable.
  if (!otpLengthStr) throw new Error('Missing required environment variable: OTP_LENGTH');
  if (!otpExpireMinutesStr) throw new Error('Missing required environment variable: OTP_EXPIRE_MINUTES');
  if (!otpMaxAttemptsStr) throw new Error('Missing required environment variable: OTP_MAX_ATTEMPTS');
  if (!otpHashSecret) throw new Error('Missing required environment variable: OTP_HASH_SECRET');

  const otpLength = Number(otpLengthStr);
  const otpExpireMinutes = Number(otpExpireMinutesStr);
  const otpMaxAttempts = Number(otpMaxAttemptsStr);
  const otpBlockMinutes = Number(otpBlockMinutesStr ?? '15');
  const otpResendCooldownMinutes = Number(otpResendCooldownMinutesStr ?? '1');

  if (Number.isNaN(otpBlockMinutes) || otpBlockMinutes < 0) {
    throw new Error('Invalid environment variable: OTP_BLOCK_MINUTES must be a non-negative number');
  }
  if (Number.isNaN(otpResendCooldownMinutes) || otpResendCooldownMinutes < 0) {
    throw new Error('Invalid environment variable: OTP_RESEND_COOLDOWN_MINUTES must be a non-negative number');
  }

  if (!pollinationsEndpoint) throw new Error('Missing required environment variable: POLLINATIONS_ENDPOINT');

  if (!pollinationsModel) throw new Error('Missing required environment variable: POLLINATIONS_MODEL');
  if (!pollinationsApiKey) throw new Error('Missing required environment variable: POLLINATIONS_API_KEY');
  if (!aiTimeoutMs) throw new Error('Missing required environment variable: AI_TIMEOUT_MS');
  if (!botThrottleMs) throw new Error('Missing required environment variable: BOT_THROTTLE_MS');
  if (!waSessionDir) throw new Error('Missing required environment variable: WA_SESSION_DIR');
  if (!smtpHost) throw new Error('Missing required environment variable: SMTP_HOST');
  if (!smtpPort) throw new Error('Missing required environment variable: SMTP_PORT');
  if (!smtpUser) throw new Error('Missing required environment variable: SMTP_USER');
  if (!smtpPass) throw new Error('Missing required environment variable: SMTP_PASS');
  if (!smtpFrom) throw new Error('Missing required environment variable: SMTP_FROM');

  return {
    MYSQL_HOST: mysqlHost,
    MYSQL_PORT: mysqlPort,
    MYSQL_USER: mysqlUser,
    MYSQL_PASSWORD: mysqlPassword,
    MYSQL_DATABASE: mysqlDatabase,
    MYSQL_POOL_SIZE: mysqlPoolSize,

    DB_REQUIRED: dbRequired,
    DB_INIT_RETRIES: dbInitRetries,
    DB_INIT_RETRY_DELAY_MS: dbInitRetryDelayMs,

    POLLINATIONS_ENDPOINT: pollinationsEndpoint,

    POLLINATIONS_MODEL: pollinationsModel,
    POLLINATIONS_API_KEY: pollinationsApiKey,
    AI_TIMEOUT_MS: Number(aiTimeoutMs),
    BOT_THROTTLE_MS: Number(botThrottleMs),
    WA_SESSION_DIR: waSessionDir,
    ALLOWED_WA_IDS: allowedWaIds,
    ADMIN_WA_IDS: adminWaIds,
    USE_BAILEYS: useBaileys,
    SMTP_HOST: smtpHost,
    SMTP_PORT: Number(smtpPort),
    SMTP_USER: smtpUser,
    SMTP_PASS: smtpPass,
    SMTP_SECURE: smtpSecure.toLowerCase() === 'true',
    SMTP_FROM: smtpFrom,
    LOG_LEVEL: process.env.LOG_LEVEL ?? 'info',

    OTP_LENGTH: otpLength,
    OTP_EXPIRE_MINUTES: otpExpireMinutes,
    OTP_MAX_ATTEMPTS: otpMaxAttempts,
    OTP_HASH_SECRET: otpHashSecret,
    OTP_BLOCK_MINUTES: otpBlockMinutes,
    OTP_RESEND_COOLDOWN_MINUTES: otpResendCooldownMinutes
  };
}



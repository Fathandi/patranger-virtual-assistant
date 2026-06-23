import pkg from 'whatsapp-web.js';
const { Client, LocalAuth } = pkg;
import qrcode from 'qrcode-terminal';
import { IWhatsAppTransport } from '../../application/ports/IWhatsAppTransport.js';
import { WaId } from '../../domain/value-objects/WaId.js';
import { createLogger } from '../../config/logger.js';
import fs from 'fs';
import path from 'path';

const logger = createLogger(process.env.LOG_LEVEL ?? 'info');

export class WhatsAppWebAdapter implements IWhatsAppTransport {
  private client: any;
  private reconnectIntervalId: NodeJS.Timeout | null = null;
  private qrTimeoutId: NodeJS.Timeout | null = null;
  private sessionDir: string;

  constructor(sessionDir: string, private onMessageCallback: (msg: any) => void) {
    this.sessionDir = sessionDir;

    // Ensure session directory permissions
    try {
      if (!fs.existsSync(sessionDir)) fs.mkdirSync(sessionDir, { recursive: true });
      fs.chmodSync(sessionDir, 0o700);
    } catch (e) {
      logger.warn({ err: String(e) }, 'Unable to enforce session dir permissions');
    }

    this.client = new Client({
      authStrategy: new LocalAuth({ clientId: 'bot', dataPath: sessionDir }),
      puppeteer: {
        args: ['--no-sandbox', '--disable-setuid-sandbox']
      }
    });

    this.client.on('qr', (qr: string) => {
      logger.info('QR Received');
      qrcode.generate(qr, { small: true });

      // If QR is not scanned within configured timeout, attempt to re-init to regenerate
      const qrTimeoutMs = Number(process.env.QR_TIMEOUT_MS || 60000);
      if (this.qrTimeoutId) clearTimeout(this.qrTimeoutId);
      this.qrTimeoutId = setTimeout(async () => {
        logger.info({ timeout: qrTimeoutMs }, 'QR not scanned in time — attempting re-init');
        try {
          await this.client.initialize();
        } catch (e) {
          logger.warn({ err: String(e) }, 'Re-init after QR timeout failed');
        }
      }, qrTimeoutMs);
    });

    this.client.on('ready', () => {
      logger.info('WhatsApp is ready!');
      // Clear any QR timeout if ready
      if (this.qrTimeoutId) {
        clearTimeout(this.qrTimeoutId);
        this.qrTimeoutId = null;
      }
      // clear reconnect attempts when ready
      if (this.reconnectIntervalId) {
        clearInterval(this.reconnectIntervalId);
        this.reconnectIntervalId = null;
      }
    });
    
    this.client.on('message', async (msg: any) => {
      logger.info({ messageId: msg.id?.id, fromNumber: msg.from, hasCallback: !!this.onMessageCallback }, 'Message received from WhatsApp');
      if (this.onMessageCallback) {
        try {
          await this.onMessageCallback(msg);
        } catch (err) {
          logger.error({ err, messageId: msg.id?.id }, 'Error in message callback');
        }
      }
    });
    
    this.setupErrorHandlers();
  }

  async init(): Promise<void> {
    logger.info('Initializing WhatsAppWebAdapter...');
    await this.client.initialize();
    // Schedule daily session backup if configured
    const backupDir = process.env.SESSION_BACKUP_DIR;
    if (backupDir) {
      try {
        if (!fs.existsSync(backupDir)) fs.mkdirSync(backupDir, { recursive: true });
        const backupIntervalMs = Number(process.env.SESSION_BACKUP_INTERVAL_MS || 24 * 60 * 60 * 1000);
        setInterval(() => {
          try {
            const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
            const dest = path.join(backupDir, `session-backup-${timestamp}.tar`);
            // Best-effort: create a tar of sessionDir if tar is available
            // Fallback: copy files
            const files = fs.readdirSync(this.sessionDir);
            files.forEach((f) => {
              const src = path.join(this.sessionDir, f);
              const dst = path.join(backupDir, `${timestamp}-${f}`);
              try { fs.copyFileSync(src, dst); fs.chmodSync(dst, 0o600); } catch (_) {}
            });
          } catch (e) {
            logger.warn({ err: String(e) }, 'Session backup failed');
          }
        }, backupIntervalMs);
      } catch (e) {
        logger.warn({ err: String(e) }, 'Unable to schedule session backup');
      }
    }
  }

  async sendText(destination: WaId, text: string): Promise<void> {
    await this.client.sendMessage(destination.value, text);
  }

  async setTyping(destination: WaId, isTyping: boolean): Promise<void> {
    const chat = await this.client.getChatById(destination.value);
    if (isTyping) {
      await chat.sendStateTyping();
    } else {
      await chat.clearState();
    }
  }

  private setupErrorHandlers() {
    this.client.on('disconnected', (reason: any) => {
      logger.warn({ reason }, 'Client disconnected');
      // Try reconnect loop
      const reconnectIntervalMs = Number(process.env.RECONNECT_INTERVAL_MS || 10000);
      if (this.reconnectIntervalId) return; // already trying
      this.reconnectIntervalId = setInterval(async () => {
        logger.info({ attemptEveryMs: reconnectIntervalMs }, 'Attempting re-initialize after disconnect');
        try {
          await this.client.initialize();
        } catch (e) {
          logger.warn({ err: String(e) }, 'Reconnect attempt failed');
        }
      }, reconnectIntervalMs);
    });
    this.client.on('auth_failure', (msg: any) => {
      logger.error({ msg }, 'Authentication failed');
      // auth failure likely requires manual re-login; still attempt a re-init after delay
      setTimeout(async () => {
        try {
          await this.client.initialize();
        } catch (e) {
          logger.warn({ err: String(e) }, 'Re-init after auth failure failed');
        }
      }, Number(process.env.AUTH_FAILURE_RETRY_MS || 10000));
    });
  }
}

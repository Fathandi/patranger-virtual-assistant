import fs from 'fs';
import path from 'path';
import qrcode from 'qrcode-terminal';
import { createLogger } from '../../config/logger.js';
import { IWhatsAppTransport } from '../../application/ports/IWhatsAppTransport.js';
import { WaId } from '../../domain/value-objects/WaId.js';

const logger = createLogger(process.env.LOG_LEVEL ?? 'info');

export class BaileysAdapter implements IWhatsAppTransport {
  private sock: any;
  private onMessageCallback: (msg: any) => Promise<void>;
  private sessionFile: string;

  constructor(sessionDir: string, onMessageCallback: (msg: any) => Promise<void>) {
    this.onMessageCallback = onMessageCallback;
    this.sessionFile = path.join(sessionDir, 'baileys_auth.json');

    try {
      if (!fs.existsSync(sessionDir)) fs.mkdirSync(sessionDir, { recursive: true });
      fs.chmodSync(sessionDir, 0o700);
    } catch (e) {
      logger.warn({ err: String(e) }, 'Unable to ensure sessionDir permissions for Baileys');
    }
  }

  async init(): Promise<void> {
    logger.info('Initializing Baileys adapter...');
    let baileys: any;
    try {
      baileys = await import('@whiskeysockets/baileys');
    } catch (e) {
      logger.error({ err: String(e) }, 'Baileys module not available; please `npm install` @whiskeysockets/baileys');
      throw e;
    }

    const { default: makeWASocket, useMultiFileAuthState, DisconnectReason, fetchLatestBaileysVersion, downloadContentFromMessage } = baileys;

    const { state, saveCreds } = await useMultiFileAuthState(this.sessionFile);

    const { version } = await fetchLatestBaileysVersion().catch(() => ({ version: [2, 2204, 13] }));

    logger.info({ version: version.join('.') }, 'Creating WhatsApp socket with Baileys');
    this.sock = makeWASocket({
      auth: state,
      version
    });

    this.sock.ev.on('creds.update', saveCreds);

    this.sock.ev.on('connection.update', (update: any) => {
      const { connection, lastDisconnect, qr } = update;
      if (qr) {
        logger.info('📱 Baileys QR received (scan dengan WhatsApp di phone kamu)');
        qrcode.generate(qr, { small: true });
      }
      if (connection === 'close') {
        const code = lastDisconnect?.error?.output?.statusCode;
        logger.warn({ code }, 'Baileys connection closed, reconnecting...');
        setTimeout(async () => {
          try {
            await this.reconnect();
          } catch (e) {
            logger.warn({ err: String(e) }, 'Baileys reconnect failed');
          }
        }, Number(process.env.RECONNECT_INTERVAL_MS || 10000));
      }
      if (connection === 'open') {
        logger.info('✅ Baileys connected! Bot ready.');
      }
    });

    this.sock.ev.on('messages.upsert', async (m: any) => {
      try {
        const message = m.messages[0];
        if (!message) return;
        if (message.key && message.key.fromMe) return; // skip outgoing

        // normalize to shape expected by MessageMapper
        const from = message.key.remoteJid;
        const id = { _serialized: message.key.id || `${message.key.remoteJid}-${Date.now()}` };
        const body = (
          message.message?.conversation ||
          message.message?.extendedTextMessage?.text ||
          message.message?.imageMessage?.caption ||
          message.message?.videoMessage?.caption ||
          ''
        );

        const hasMedia = !!(
          message.message?.imageMessage ||
          message.message?.videoMessage ||
          message.message?.documentMessage ||
          message.message?.audioMessage
        );

        const rawMsg: any = {
          id,
          from,
          to: this.sock.user?.id?.split(':')[0] + '@s.whatsapp.net',
          body,
          type: hasMedia ? 'media' : 'chat',
          hasMedia,
          // downloadMedia function expected by MessageMapper
          downloadMedia: async () => {
            try {
              const mtype = Object.keys(message.message)[0];
              const stream = await downloadContentFromMessage(message.message[mtype], mtype.replace(/Message$/, ''));
              const buffers: Buffer[] = [];
              for await (const chunk of stream) buffers.push(chunk as Buffer);
              const data = Buffer.concat(buffers).toString('base64');
              const mimetype = message.message[mtype].mimetype || 'application/octet-stream';
              return { data, mimetype };
            } catch (e) {
              logger.warn({ err: String(e) }, 'Failed to download media');
              return null;
            }
          }
        };

        if (this.onMessageCallback) await this.onMessageCallback(rawMsg);
      } catch (e) {
        logger.error({ err: String(e) }, 'Error processing incoming Baileys message');
      }
    });
  }

  async reconnect() {
    try {
      if (this.sock) {
        try { this.sock.logout?.(); } catch (_) {}
      }
      await this.init();
    } catch (e) {
      logger.warn({ err: String(e) }, 'Reconnect init error');
    }
  }

  async sendText(destination: WaId, text: string): Promise<void> {
    if (!this.sock) throw new Error('Baileys socket not initialized');
    await this.sock.sendMessage(destination.value, { text });
  }

  async setTyping(destination: WaId, isTyping: boolean): Promise<void> {
    if (!this.sock) return;
    try {
      await this.sock.sendPresenceUpdate(isTyping ? 'composing' : 'available', destination.value);
    } catch (e) {
      // ignore
    }
  }
}

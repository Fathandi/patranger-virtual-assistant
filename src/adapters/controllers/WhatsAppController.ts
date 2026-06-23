import { RegisterUser } from '../../application/use-cases/auth/RegisterUser.js';
import { VerifyOTP } from '../../application/use-cases/auth/VerifyOTP.js';
import { ResendOTP } from '../../application/use-cases/auth/ResendOTP.js';
import { GuardAccess } from '../../application/use-cases/auth/GuardAccess.js';
import { RouteMessage } from '../../application/use-cases/messaging/RouteMessage.js';
import { GenerateReply } from '../../application/use-cases/ai/GenerateReply.js';
import { AnalyzeMessage } from '../../application/use-cases/ai/AnalyzeMessage.js';
import { IMessageRepository } from '../../domain/repositories/IMessageRepository.js';
import { IUserRepository } from '../../domain/repositories/IUserRepository.js';
import { WaId } from '../../domain/value-objects/WaId.js';
import { ContextMessage } from '../../domain/entities/ContextMessage.js';
import { MessageMapper } from '../mappers/MessageMapper.js';
import { createLogger } from '../../config/logger.js';

const logger = createLogger(process.env.LOG_LEVEL ?? 'info');

export class WhatsAppController {
  constructor(
    private registerUser: RegisterUser,
    private verifyOTP: VerifyOTP,
    private resendOTP: ResendOTP,
    private guardAccess: GuardAccess,
    private routeMessage: RouteMessage,
    private generateReply: GenerateReply,
    private analyzeMessage: AnalyzeMessage,
    private messageRepository: IMessageRepository,
    private userRepository: IUserRepository,
    private transport: any
  ) {}

  async handle(rawMsg: any): Promise<void> {
    const safePreview = (text: string) => {
      if (process.env.LOG_LEVEL === 'debug') return text;
      return `<len:${String(text ?? '').length}>`;
    };

    const sanitizeErrorForLog = (err: any) => {
      if (err instanceof Error) {
        return { message: err.message, stack: process.env.LOG_LEVEL === 'debug' ? err.stack : undefined };
      }
      return { message: String(err) };
    };

    logger.info({ rawMsgId: rawMsg.id?.id, rawMsgFrom: rawMsg.from }, 'Controller.handle called with raw message');
    try {
      const msg = await MessageMapper.fromWA(rawMsg);
      logger.info({ from: msg.fromWaId.toObfuscatedString(), bodyPreview: safePreview(msg.body) }, 'Incoming message');

      const bodyLower = msg.body.toLowerCase();
      const command = msg.body.split(/[ \t|]/)[0]?.toLowerCase() ?? '';

      // Admin command protection: prefix `!admin` or configured admin list
      if (command.startsWith('!admin')) {
        const adminList = (process.env.ADMIN_WA_IDS || '').split(',').map(s => s.trim()).filter(Boolean);
        if (!adminList.includes(msg.fromWaId.value)) {
          await this.transport.sendText(msg.fromWaId, 'Anda tidak punya akses admin.');
          return;
        }
        // Simple admin handler example: `!admin status`
        const parts = msg.body.split(/\s+/);
        const sub = parts[1]?.toLowerCase() ?? '';
        if (sub === 'status') {
          await this.transport.sendText(msg.fromWaId, 'Bot status: OK');
          return;
        }
        await this.transport.sendText(msg.fromWaId, 'Perintah admin tidak dikenal. Contoh: !admin status');
        return;
      }

      // 1. Dispatch Auth Commands
      if (command === '!register') {
        const parts = msg.body.split('|').map((p) => p.trim());
        if (parts.length !== 3 || !parts[1] || !parts[2]) {
          await this.transport.sendText(
            msg.fromWaId,
            'Format daftar salah. Gunakan: !register|Nama|email@domain.com'
          );
          return;
        }

        await this.registerUser.execute(msg.fromWaId.value, parts[1], parts[2]);
        return;
      }

      if (command === '!verify') {
        const parts = msg.body.trim().split(/\s+/);
        if (parts.length !== 2) return; // Simple skip if malformed
        await this.verifyOTP.execute(msg.fromWaId.value, parts[1].trim());
        return;
      }

      if (bodyLower === '!resendotp') {
        await this.resendOTP.execute(msg.fromWaId.value);
        return;
      }

      // 2. Guard Access (allowlist presence check)
      const hasAccess = await this.guardAccess.execute(msg.fromWaId.value);
      if (!hasAccess) {
        logger.info({ from: msg.fromWaId.value }, 'Message rejected (guard / not allowed)');
        return;
      }

      // 2.1 Auth state machine (enforce your desired flow)
      // - if not registered => instruct register
      // - if registered but not verified => instruct verify
      // - if verified => proceed to AI
      const waId = msg.fromWaId.value;
      const verification = await this.userRepository.getLatestOTP(new (msg.fromWaId.constructor as any)(waId));
      const user = await this.userRepository.findUserByWaId(msg.fromWaId);

      const isRegistered = Boolean(user);
      const isVerified = Boolean(user?.isVerified);

      if (!isRegistered) {
        // If user hasn't registered, guide them. Use same syntax your RegisterUser expects.
        await this.transport.sendText(msg.fromWaId, 'Belum daftar. Ketik:\n!register|Nama|email@domain.com');
        return;
      }

      if (!isVerified) {
        if (!verification) {
          await this.transport.sendText(msg.fromWaId, 'Belum ada OTP. Ketik:\n!resendotp');
          return;
        }
        await this.transport.sendText(msg.fromWaId, 'Akun belum terverifikasi. Ketik:\n!verify 123456 (ganti dengan OTP dari email)');
        return;
      }

      // Persist Incoming
      const insertedId = await this.messageRepository.insertMessage(msg);
      const messageId = insertedId ?? 0;

      // 2.5 Auto analysis using AI with recent session context
      const recentMessages = await this.messageRepository.getRecentMessages(msg.fromWaId.value, 10);
      const contextHistory: ContextMessage[] = recentMessages
        .filter((item) => item.body && item.body.trim() !== '')
        .reverse()
        .map((item) => ({
          from: item.fromWaId.value,
          body: item.body,
          timestamp: item.timestamp,
          role: (item.isFromBot ? 'assistant' : 'user') as 'assistant' | 'user'
        }));

      const analysis = await this.analyzeMessage.execute(messageId, msg, contextHistory);
      await this.messageRepository.insertMessageAnalysis({
        messageId: Number(analysis.message_id),
        intent: analysis.intent,
        sentiment: analysis.sentiment,
        confidence: analysis.confidence
      });

      // 3. Route Message
      logger.info({ from: msg.fromWaId.toObfuscatedString() }, 'Routing message');
      const routeOutput = this.routeMessage.execute(msg);
      if (!routeOutput) {
        logger.info({ from: msg.fromWaId.value }, 'Message filtered by routing');
        return;
      }

      // 4. Generate Reply
      logger.info({ from: msg.fromWaId.value }, 'Generating reply');
      const replyText = await this.generateReply.execute(
        msg.fromWaId.value,
        msg.body,
        routeOutput.context,
        Number(process.env.BOT_THROTTLE_MS || 5000),
        routeOutput.needsProcessConfirmation
      );

      // 5. Update Context & Persist Outgoing
      logger.info(
        {
          from: msg.fromWaId.toObfuscatedString(),
          to: msg.toWaId.toObfuscatedString(),
          replyLength: replyText.length,
          needsProcessConfirmation: routeOutput.needsProcessConfirmation
        },
        'Reply generated, preparing outgoing'
      );
      this.routeMessage.addReplyToContext(msg.fromWaId.value, replyText);
      
      const outgoingMsg = {
        messageWaId: `${msg.messageWaId}-bot`,
        fromWaId: msg.toWaId,
        toWaId: msg.fromWaId,
        body: replyText,
        mediaType: 'chat',
        timestamp: Date.now(),
        isFromBot: true
      };
      
      logger.info({ from: msg.fromWaId.value }, 'Persisting outgoing message');
      await this.messageRepository.insertMessage(outgoingMsg);
      logger.info({ from: msg.fromWaId.toObfuscatedString() }, 'Message flow completed successfully');

    } catch (err) {
      logger.error({ err: sanitizeErrorForLog(err) }, 'Controller handle error');
    }
  }
}

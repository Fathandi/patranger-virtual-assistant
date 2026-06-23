import { loadConfig } from './config/index.js';
import { createLogger } from './config/logger.js';

import { DatabaseConnection } from './infrastructure/db/DatabaseConnection.js';
import { NullUserRepository, NullSessionRepository, NullMessageRepository } from './infrastructure/db/NullRepositories.js';
import { MysqlUserRepository } from './infrastructure/db/MysqlUserRepository.js';
import { MysqlSessionRepository } from './infrastructure/db/MysqlSessionRepository.js';
import { MysqlMessageRepository } from './infrastructure/db/MysqlMessageRepository.js';
import { PollinationsAdapter } from './infrastructure/ai/PollinationsAdapter.js';
import { SmtpMailAdapter } from './infrastructure/mail/SmtpMailAdapter.js';
import { WhatsAppWebAdapter } from './infrastructure/transport/WhatsAppWebAdapter.js';
import { BaileysAdapter } from './infrastructure/transport/BaileysAdapter.js';

import { RegisterUser } from './application/use-cases/auth/RegisterUser.js';
import { VerifyOTP } from './application/use-cases/auth/VerifyOTP.js';
import { ResendOTP } from './application/use-cases/auth/ResendOTP.js';
import { GuardAccess } from './application/use-cases/auth/GuardAccess.js';
import { RouteMessage } from './application/use-cases/messaging/RouteMessage.js';
import { GenerateReply } from './application/use-cases/ai/GenerateReply.js';
import { AnalyzeMessage } from './application/use-cases/ai/AnalyzeMessage.js';

import { ContextStoreGateway } from './adapters/gateways/ContextStoreGateway.js';
import { WhatsAppController } from './adapters/controllers/WhatsAppController.js';
import { OtpCode } from './domain/value-objects/OtpCode.js';


async function bootstrap() {
  const config = loadConfig();
  const logger = createLogger(config.LOG_LEVEL);
  logger.info('Starting Composition Root');

  // 1. Init Infra
  const dbConnection = new DatabaseConnection(config);
  await dbConnection.connect();

  let userRepository, sessionRepository, messageRepository;
  if (dbConnection.available && dbConnection.pool) {
    userRepository = new MysqlUserRepository(dbConnection.pool);
    sessionRepository = new MysqlSessionRepository(dbConnection.pool);
    messageRepository = new MysqlMessageRepository(dbConnection.pool);
  } else {
    userRepository = new NullUserRepository();
    sessionRepository = new NullSessionRepository();
    messageRepository = new NullMessageRepository();
  }

  const aiService = new PollinationsAdapter(
    config.POLLINATIONS_ENDPOINT,
    config.POLLINATIONS_MODEL,
    config.POLLINATIONS_API_KEY,
    config.AI_TIMEOUT_MS
  );

  const mailService = new SmtpMailAdapter(
    config.SMTP_HOST,
    config.SMTP_PORT,
    config.SMTP_SECURE,
    config.SMTP_USER,
    config.SMTP_PASS,
    config.SMTP_FROM
  );

  let whatsappAdapter: any;

  // 2. Init Gateways & Use Cases

  // OTP wiring from config
  OtpCode.configure(config.OTP_LENGTH, config.OTP_EXPIRE_MINUTES);

  const contextGateway = new ContextStoreGateway(10);

  // Choose transport: Baileys or WhatsAppWeb
  if (String(config.USE_BAILEYS || 'false').toLowerCase() === 'true') {
    logger.info('🚀 Using Baileys transport');
    whatsappAdapter = new BaileysAdapter(config.WA_SESSION_DIR, async (msg: any) => {
      if (controller) await controller.handle(msg);
    });
  } else {
    logger.info('🚀 Using WhatsAppWeb transport');
    whatsappAdapter = new WhatsAppWebAdapter(config.WA_SESSION_DIR, async (msg) => {
      if (controller) await controller.handle(msg);
    });
  }

  const registerUser = new RegisterUser(
    userRepository,
    mailService,
    whatsappAdapter,
    config.OTP_HASH_SECRET
  );
  const verifyOTP = new VerifyOTP(
    userRepository,
    sessionRepository,
    whatsappAdapter,
    config.OTP_HASH_SECRET,
    config.OTP_MAX_ATTEMPTS,
    config.OTP_BLOCK_MINUTES
  );
  const resendOTP = new ResendOTP(
    userRepository,
    mailService,
    whatsappAdapter,
    config.OTP_HASH_SECRET,
    config.OTP_RESEND_COOLDOWN_MINUTES
  );
  const guardAccess = new GuardAccess(
    userRepository,
    sessionRepository,
    config.ALLOWED_WA_IDS.split(',').map((s) => s.trim()).filter(Boolean)
  );


  const routeMessage = new RouteMessage(contextGateway, config.ALLOWED_WA_IDS.split(',').filter(Boolean), 400);
  const generateReply = new GenerateReply(aiService, whatsappAdapter);
  const analyzeMessage = new AnalyzeMessage(aiService, messageRepository);

  // 3. Init Controller
  const controller = new WhatsAppController(
    registerUser,
    verifyOTP,
    resendOTP,
    guardAccess,
    routeMessage,
    generateReply,
    analyzeMessage,
    messageRepository,
    userRepository,
    whatsappAdapter
  );

  // 4. Start Transport
  await whatsappAdapter.init();

  // 5. Graceful Shutdown
  process.on('SIGINT', async () => {
    logger.info('Graceful shutdown...');
    await dbConnection.close();
    process.exit(0);
  });
}

bootstrap().catch(console.error);

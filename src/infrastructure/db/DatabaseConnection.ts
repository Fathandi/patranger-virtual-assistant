import mysql from 'mysql2/promise';
import { AppConfig } from '../../config/index.js';
import { createLogger } from '../../config/logger.js';

const logger = createLogger(process.env.LOG_LEVEL ?? 'info');

export class DatabaseConnection {
  public pool: mysql.Pool | null = null;
  public available: boolean = false;

  constructor(private config: AppConfig) {}

  async connect(): Promise<void> {
    this.pool = mysql.createPool({
      host: this.config.MYSQL_HOST,
      port: this.config.MYSQL_PORT,
      user: this.config.MYSQL_USER,
      password: this.config.MYSQL_PASSWORD,
      database: this.config.MYSQL_DATABASE,
      waitForConnections: true,
      connectionLimit: this.config.MYSQL_POOL_SIZE,
      queueLimit: 0,
      charset: 'utf8mb4'
    });

    const retries = this.config.DB_INIT_RETRIES;
    for (let attempt = 1; attempt <= retries; attempt++) {
      try {
        await this.ensureSchema();
        this.available = true;
        logger.info('Database connected successfully');
        return;
      } catch (err) {
        if (attempt === retries) {
          logger.error('Failed to connect to database after retries');
          this.available = false;
        } else {
          await new Promise(r => setTimeout(r, this.config.DB_INIT_RETRY_DELAY_MS));
        }
      }
    }
  }

  async close(): Promise<void> {
    if (this.pool) await this.pool.end();
  }

  private async ensureSchema(): Promise<void> {
    if (!this.pool) return;

    await this.pool.execute(`
      CREATE TABLE IF NOT EXISTS contacts (
        wa_id VARCHAR(100) PRIMARY KEY,
        name VARCHAR(255),
        pushname VARCHAR(255),
        profile_pic_url TEXT,
        email VARCHAR(255),
        is_verified BOOLEAN DEFAULT FALSE,
        verified_at TIMESTAMP NULL,
        is_active BOOLEAN DEFAULT TRUE,
        first_seen TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        last_seen TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        INDEX idx_email (email),
        INDEX idx_is_verified (is_verified)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
    `);

    await this.pool.execute(`
      CREATE TABLE IF NOT EXISTS user_verification (
        id BIGINT AUTO_INCREMENT PRIMARY KEY,
        wa_id VARCHAR(100) NOT NULL,
        email VARCHAR(255) NOT NULL,
        otp_hash VARCHAR(128) NOT NULL,
        otp_expires_at TIMESTAMP NOT NULL,
        attempts INT NOT NULL DEFAULT 0,
        blocked_until TIMESTAMP NULL DEFAULT NULL,
        last_sent_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
        is_verified BOOLEAN DEFAULT FALSE,
        verified_at TIMESTAMP NULL,
        created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        INDEX idx_wa_id (wa_id),
        INDEX idx_otp_hash (otp_hash),
        INDEX idx_expires_at (otp_expires_at),
        FOREIGN KEY (wa_id) REFERENCES contacts(wa_id) ON DELETE CASCADE
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
    `);

    await this.pool.execute(`
      CREATE TABLE IF NOT EXISTS user_sessions (
        id BIGINT AUTO_INCREMENT PRIMARY KEY,
        session_uuid VARCHAR(36) NOT NULL UNIQUE,
        wa_id VARCHAR(100) NOT NULL,
        created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
        expires_at TIMESTAMP NOT NULL,
        last_activity_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        is_active BOOLEAN DEFAULT TRUE,
        INDEX idx_wa_id (wa_id),
        INDEX idx_expires_at (expires_at),
        FOREIGN KEY (wa_id) REFERENCES contacts(wa_id) ON DELETE CASCADE
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
    `);

    await this.pool.execute(`
      CREATE TABLE IF NOT EXISTS messages (
        id BIGINT AUTO_INCREMENT PRIMARY KEY,
        message_wa_id VARCHAR(255) UNIQUE,
        from_wa_id VARCHAR(100),
        to_wa_id VARCHAR(100),
        body TEXT,
        media_type VARCHAR(50),
        media_url TEXT,
        timestamp BIGINT,
        is_from_bot BOOLEAN DEFAULT FALSE,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        INDEX idx_from_wa_id (from_wa_id)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
    `);

    await this.pool.execute(`
      CREATE TABLE IF NOT EXISTS message_analysis (
        id BIGINT AUTO_INCREMENT PRIMARY KEY,
        message_id BIGINT,
        intent VARCHAR(100),
        sentiment VARCHAR(50),
        confidence DOUBLE,
        analyzed_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        INDEX idx_message_id (message_id),
        FOREIGN KEY (message_id) REFERENCES messages(id) ON DELETE CASCADE
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
    `);
  }
}

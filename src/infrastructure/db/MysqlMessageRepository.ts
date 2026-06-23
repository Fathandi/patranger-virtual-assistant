import { Pool, OkPacket, RowDataPacket } from 'mysql2/promise';
import { IMessageRepository, MessageAnalysis } from '../../domain/repositories/IMessageRepository.js';
import { Message } from '../../domain/entities/Message.js';
import { WaId } from '../../domain/value-objects/WaId.js';
import { createLogger } from '../../config/logger.js';

const logger = createLogger(process.env.LOG_LEVEL ?? 'info');

export class MysqlMessageRepository implements IMessageRepository {
  constructor(private pool: Pool) {}

  async insertMessage(message: Message): Promise<number | null> {
    try {
      const [result] = await this.pool.execute<OkPacket>(
        `INSERT INTO messages (message_wa_id, from_wa_id, to_wa_id, body, media_type, media_url, timestamp, is_from_bot)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?)
         ON DUPLICATE KEY UPDATE body = VALUES(body), media_type = VALUES(media_type), media_url = VALUES(media_url)`,
        [
          message.messageWaId,
          message.fromWaId.value,
          message.toWaId.value,
          message.body,
          message.mediaType ?? null,
          message.mediaUrl ?? null,
          message.timestamp,
          message.isFromBot
        ]
      );
      logger.info({ messageWaId: message.messageWaId, insertId: result.insertId }, 'DB insertMessage success');
      return result.insertId;
    } catch (err) {
      logger.error({ err, messageWaId: message.messageWaId }, 'DB insertMessage failed');
      return null;
    }
  }

  async insertMessageAnalysis(analysis: MessageAnalysis): Promise<void> {
    try {
      await this.pool.execute(
        `INSERT INTO message_analysis (message_id, intent, sentiment, confidence)
         VALUES (?, ?, ?, ?)`,
        [analysis.messageId, analysis.intent, analysis.sentiment, analysis.confidence]
      );
      logger.info({ messageId: analysis.messageId }, 'DB insertMessageAnalysis success');
    } catch (err) {
      logger.error({ err, messageId: analysis.messageId }, 'DB insertMessageAnalysis failed');
    }
  }

  async getRecentMessages(waId: string, limit: number): Promise<Message[]> {
    try {
      const [rows] = await this.pool.execute<RowDataPacket[]>(
        `SELECT message_wa_id, from_wa_id, to_wa_id, body, media_type, media_url, timestamp, is_from_bot
         FROM messages
         WHERE from_wa_id = ? OR to_wa_id = ?
         ORDER BY timestamp DESC
         LIMIT ?`,
        [waId, waId, limit]
      );

      return rows.map((row) => ({
        messageWaId: row.message_wa_id,
        fromWaId: new WaId(row.from_wa_id),
        toWaId: new WaId(row.to_wa_id),
        body: row.body,
        mediaType: row.media_type,
        mediaUrl: row.media_url,
        timestamp: Number(row.timestamp),
        isFromBot: Boolean(row.is_from_bot)
      }));
    } catch (err) {
      logger.error({ err, waId }, 'DB getRecentMessages failed');
      return [];
    }
  }

  async getRecentMessageAnalysis(waId: string, limit: number): Promise<MessageAnalysis[]> {
    try {
      const [rows] = await this.pool.execute<RowDataPacket[]>(
        `SELECT ma.message_id, ma.intent, ma.sentiment, ma.confidence
         FROM message_analysis ma
         JOIN messages m ON ma.message_id = m.id
         WHERE m.from_wa_id = ? OR m.to_wa_id = ?
         ORDER BY m.timestamp DESC
         LIMIT ?`,
        [waId, waId, limit]
      );

      return rows.map((row) => ({
        messageId: Number(row.message_id),
        intent: String(row.intent),
        sentiment: String(row.sentiment),
        confidence: Number(row.confidence)
      } as MessageAnalysis));
    } catch (err) {
      logger.error({ err, waId }, 'DB getRecentMessageAnalysis failed');
      return [];
    }
  }
}

/**
 * MessageAnalysis Entity
 * Represents structured analysis of a WhatsApp message
 */

export enum MessageIntent {
  // User inquiries
  GREETING = 'greeting',
  QUERY = 'query',
  QUESTION = 'question',
  COMMAND = 'command',

  // Context-specific
  INFO_LOKER = 'info_loker',
  INFO_KURSUS = 'info_kursus',
  TECHNICAL_HELP = 'technical_help',
  PRICING = 'pricing',

  // Meta
  FEEDBACK = 'feedback',
  COMPLAINT = 'complaint',
  ESCALATE = 'escalate',

  // System
  UNCLEAR = 'unclear',
  SPAM = 'spam',
  ERROR = 'error',
  SENSITIVE = 'sensitive',
}

export enum MessageSentiment {
  POSITIVE = 'positive',
  NEUTRAL = 'neutral',
  NEGATIVE = 'negative',
}

export interface MessageAnalysisData {
  id?: bigint;
  message_id: bigint;
  intent: MessageIntent;
  sentiment: MessageSentiment;
  confidence: number; // 0.0 - 1.0
  entities?: string; // JSON string of extracted entities
  category?: string; // user_message | bot_response | spam | error
  model_version?: string;
  tags?: string; // comma-separated
  analyzed_at?: Date;
}

export class MessageAnalysis {
  id?: bigint;
  message_id: bigint;
  intent: MessageIntent;
  sentiment: MessageSentiment;
  confidence: number; // 0.0 - 1.0
  entities?: Record<string, any>;
  category?: string;
  model_version?: string;
  tags?: string[];
  analyzed_at?: Date;

  // Computed property
  get shouldAutoReply(): boolean {
    return this.confidence > 0.8;
  }

  get shouldEscalate(): boolean {
    return (
      this.intent === MessageIntent.SENSITIVE ||
      this.intent === MessageIntent.ESCALATE ||
      this.intent === MessageIntent.COMPLAINT
    );
  }

  get isSuspicious(): boolean {
    return (
      this.intent === MessageIntent.SPAM ||
      this.intent === MessageIntent.ERROR ||
      (this.intent === MessageIntent.UNCLEAR && this.confidence < 0.3)
    );
  }

  constructor(data: MessageAnalysisData) {
    this.id = data.id;
    this.message_id = data.message_id;
    this.intent = data.intent;
    this.sentiment = data.sentiment;
    this.confidence = Math.max(0, Math.min(1, data.confidence)); // Clamp 0-1
    this.category = data.category || 'user_message';
    this.model_version = data.model_version || '1.0';
    this.tags = data.tags ? data.tags.split(',').map(t => t.trim()) : [];
    this.analyzed_at = data.analyzed_at || new Date();

    // Parse entities JSON if provided
    if (data.entities) {
      try {
        this.entities = typeof data.entities === 'string' ? JSON.parse(data.entities) : data.entities;
      } catch {
        this.entities = {};
      }
    } else {
      this.entities = {};
    }
  }

  /**
   * Convert to database-storable format
   */
  toDatabase() {
    return {
      message_id: this.message_id,
      intent: this.intent,
      sentiment: this.sentiment,
      confidence: this.confidence,
      entities: JSON.stringify(this.entities || {}),
      category: this.category,
      model_version: this.model_version,
      tags: this.tags?.join(', '),
      analyzed_at: this.analyzed_at || new Date(),
    };
  }
}

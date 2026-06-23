import { IAIService, AIContextMessage } from '../../ports/IAIService.js';
import { IMessageRepository } from '../../../domain/repositories/IMessageRepository.js';
import { Message } from '../../../domain/entities/Message.js';
import { MessageAnalysis, MessageAnalysisData, MessageIntent, MessageSentiment } from '../../../domain/entities/MessageAnalysis.js';
import { ContextMessage } from '../../../domain/entities/ContextMessage.js';

function buildAnalysisPrompt(message: Message, context: ContextMessage[]): string {
  const history = context
    .map((item) => `- [${item.role}] ${item.body}`)
    .join('\n');

  return `You are an assistant that analyzes a WhatsApp message and returns only valid JSON.

Instructions:
- Identify the intent from this list: greeting, query, question, command, info_loker, info_kursus, technical_help, pricing, feedback, complaint, escalate, unclear, spam, error, sensitive.
- Identify the sentiment: positive, neutral, or negative.
- Provide a confidence score between 0.0 and 1.0.
- Return an object with keys: intent, sentiment, confidence, tags, category.
- Do not include any explanation or extra text outside the JSON object.

Conversation history:
${history || 'No previous conversation.'}

Current incoming message:
"${message.body}"

Output example:
{
  "intent": "query",
  "sentiment": "neutral",
  "confidence": 0.92,
  "tags": ["support", "pricing"],
  "category": "user_message"
}
`;
}

function parseAnalysisResponse(raw: string): Record<string, any> | null {
  const start = raw.indexOf('{');
  const end = raw.lastIndexOf('}');
  if (start < 0 || end < 0 || end <= start) return null;

  const candidate = raw.slice(start, end + 1);
  try {
    return JSON.parse(candidate);
  } catch {
    return null;
  }
}

function normalizeIntent(value: unknown): MessageIntent {
  const normalized = String(value ?? '').trim().toLowerCase();
  if (Object.values(MessageIntent).includes(normalized as MessageIntent)) {
    return normalized as MessageIntent;
  }
  return MessageIntent.UNCLEAR;
}

function normalizeSentiment(value: unknown): MessageSentiment {
  const normalized = String(value ?? '').trim().toLowerCase();
  if (Object.values(MessageSentiment).includes(normalized as MessageSentiment)) {
    return normalized as MessageSentiment;
  }
  return MessageSentiment.NEUTRAL;
}

function normalizeConfidence(value: unknown): number {
  const num = Number(value);
  if (Number.isFinite(num) && num >= 0 && num <= 1) {
    return num;
  }
  return 0.5;
}

export class AnalyzeMessage {
  constructor(
    private aiService: IAIService,
    private messageRepository: IMessageRepository
  ) {}

  async execute(messageId: number, message: Message, context: ContextMessage[]): Promise<MessageAnalysis> {
    const prompt = buildAnalysisPrompt(message, context);
    const aiContext: AIContextMessage[] = context.map((item) => ({ role: item.role, content: item.body }));
    const rawResponse = await this.aiService.generateReply(prompt, aiContext);
    const parsed = parseAnalysisResponse(rawResponse) ?? {};

    const analysisData: MessageAnalysisData = {
      message_id: BigInt(messageId),
      intent: normalizeIntent(parsed.intent),
      sentiment: normalizeSentiment(parsed.sentiment),
      confidence: normalizeConfidence(parsed.confidence),
      entities: parsed.entities ? JSON.stringify(parsed.entities) : undefined,
      category: typeof parsed.category === 'string' ? parsed.category : 'user_message',
      model_version: typeof parsed.model_version === 'string' ? parsed.model_version : '1.0',
      tags: Array.isArray(parsed.tags) ? parsed.tags.join(',') : typeof parsed.tags === 'string' ? parsed.tags : undefined,
      analyzed_at: new Date()
    };

    return new MessageAnalysis(analysisData);
  }
}

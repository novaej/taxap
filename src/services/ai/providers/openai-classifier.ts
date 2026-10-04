import OpenAI from 'openai';
import { zodResponseFormat } from 'openai/helpers/zod';
import { z } from 'zod';
import type { AiClassifier, SupplierClassificationRequest, SupplierClassificationResult } from '../types';
import { buildClassificationPrompt, PROMPT_VERSION } from '../types';

/**
 * No equivalent to CLAUDE.md's Claude model table exists for OpenAI, and
 * model IDs on that side churn independently of this project -- both are
 * overridable via env instead of hardcoded, so picking this provider
 * doesn't require a code change when OpenAI renames a model.
 */
const BULK_MODEL = process.env.OPENAI_BULK_MODEL || 'gpt-4o-mini';
const ESCALATION_MODEL = process.env.OPENAI_ESCALATION_MODEL || 'gpt-4o';

// Mirrors ClaudeClassifier's threshold -- both providers implement the
// same AiClassifier contract, including when they escalate.
const ESCALATION_THRESHOLD = 0.8;

const ClassificationSchema = z.object({
  category: z.enum(['CREDIT', 'COST_EXPENSE', 'NON_DEDUCTIBLE']),
  confidence: z.number().min(0).max(1),
  reasoning: z.string(),
});

export class OpenAiClassifier implements AiClassifier {
  private client: OpenAI;

  constructor() {
    this.client = new OpenAI();
  }

  async classifySupplier(
    request: SupplierClassificationRequest
  ): Promise<SupplierClassificationResult | null> {
    const bulk = await this.ask(BULK_MODEL, request);
    if (!bulk) return null;
    if (bulk.confidence >= ESCALATION_THRESHOLD) return bulk;

    const escalated = await this.ask(ESCALATION_MODEL, request);
    return escalated ?? bulk;
  }

  private async ask(
    model: string,
    request: SupplierClassificationRequest
  ): Promise<SupplierClassificationResult | null> {
    const completion = await this.client.chat.completions.parse({
      model,
      messages: [{ role: 'user', content: buildClassificationPrompt(request) }],
      response_format: zodResponseFormat(ClassificationSchema, 'supplier_classification'),
    });

    const parsed = completion.choices[0]?.message.parsed;
    if (!parsed) return null;

    return {
      ...parsed,
      modelId: model,
      promptVersion: PROMPT_VERSION,
    };
  }
}

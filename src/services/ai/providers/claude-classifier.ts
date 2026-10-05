import Anthropic from '@anthropic-ai/sdk';
import { zodOutputFormat } from '@anthropic-ai/sdk/helpers/zod';
import { z } from 'zod';
import type { AiClassifier, SupplierClassificationRequest, SupplierClassificationResult } from '../types';
import { buildClassificationPrompt, PROMPT_VERSION } from '../types';

/**
 * CLAUDE.md -> "AI models": haiku for the bulk pass, opus only to
 * escalate a case the bulk model itself flagged as low-confidence.
 * Defaults are the project's documented choice; overridable via env like
 * the OpenAI side, so a model swap (e.g. a new Haiku generation) doesn't
 * need a code change -- update CLAUDE.md's table if the default changes.
 */
const BULK_MODEL = process.env.CLAUDE_BULK_MODEL || 'claude-haiku-4-5';
const ESCALATION_MODEL = process.env.CLAUDE_ESCALATION_MODEL || 'claude-opus-5';

// Matches the cascade's own acceptance bar (classification-cascade.ts
// level3_aiSuggestion requires >= 0.80) -- no point accepting a bulk
// answer the cascade would discard anyway without trying for a better one.
const ESCALATION_THRESHOLD = 0.8;

const ClassificationSchema = z.object({
  category: z.enum(['CREDIT', 'COST_EXPENSE', 'NON_DEDUCTIBLE']),
  confidence: z.number().min(0).max(1),
  reasoning: z.string(),
});

export class ClaudeClassifier implements AiClassifier {
  private client: Anthropic;

  constructor() {
    this.client = new Anthropic();
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
    const response = await this.client.messages.parse({
      model,
      max_tokens: 1024,
      messages: [{ role: 'user', content: buildClassificationPrompt(request) }],
      output_config: { format: zodOutputFormat(ClassificationSchema) },
    });

    if (!response.parsed_output) return null;

    return {
      ...response.parsed_output,
      modelId: model,
      promptVersion: PROMPT_VERSION,
    };
  }
}

import { ClaudeClassifier } from './providers/claude-classifier';
import { OpenAiClassifier } from './providers/openai-classifier';
import type { AiClassifier } from './types';

export type { AiClassifier, SupplierClassificationRequest, SupplierClassificationResult, AiIvaCategory } from './types';

/**
 * Which engine runs the cascade's level 3 (ADR-005), picked by
 * `AI_PROVIDER` instead of a code change -- `ClaudeClassifier` and
 * `OpenAiClassifier` both implement the same `AiClassifier` contract, so
 * swapping providers never touches the caller in conciliacion/actions.ts.
 *
 * Returns `null` when the selected provider has no API key configured:
 * that's ADR-007's "no-AI mode", not an error -- the cascade just falls
 * through to level 4 (manual review) for every supplier.
 */
export function getAiClassifier(): AiClassifier | null {
  const provider = (process.env.AI_PROVIDER || 'claude').toLowerCase();

  if (provider === 'openai') {
    return process.env.OPENAI_API_KEY ? new OpenAiClassifier() : null;
  }
  if (provider === 'claude') {
    return process.env.ANTHROPIC_API_KEY ? new ClaudeClassifier() : null;
  }

  throw new Error(`Unknown AI_PROVIDER "${provider}" -- expected "claude" or "openai"`);
}

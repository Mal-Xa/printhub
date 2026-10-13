/**
 * Computes an exponential backoff delay (ms) for the given attempt number
 * (1-based), capped at `maxMs`. Generic on purpose: used both for job
 * retry timing (parameterized by print-common's RETRY_POLICY constants)
 * and for WebSocket reconnect timing (parameterized by local transport
 * constants) -- the math is identical, only the inputs differ.
 */
export function computeBackoffMs(
  attempt: number,
  baseMs: number,
  multiplier: number,
  maxMs = 5 * 60_000
): number {
  const safeAttempt = Math.max(1, attempt);
  const delay = baseMs * Math.pow(multiplier, safeAttempt - 1);
  return Math.min(delay, maxMs);
}

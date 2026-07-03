// Central error mapper — the one place that turns a provider's raw failure
// (HTTP status + optional body message, or a fetch-level exception) into a
// normalized EngineError. Every engine adapter (trial-gateway/gemini/openai/
// deepseek) calls this instead of each duplicating its own status-code
// judgment calls, which is how they were originally written (T-014/016-018).
//
// This is INTERIM/best-effort classification by HTTP status only — no
// provider's exact error-body shape has been verified against a live
// request (deliberately deferred for the trial gateway specifically: see
// docs/ENGINES.md "Engine 1" — the owner already has quota-handling logic
// server-side, and forcing it from here isn't this project's job). Refine
// per-provider if a real response turns out not to follow standard HTTP
// semantics.

import { EngineError } from './engines/errors.js';

/**
 * @param {object} opts
 * @param {number} opts.status HTTP status code from the failed response
 * @param {string} [opts.bodyMessage] provider's own error message, if the body was parseable JSON
 * @param {string} opts.providerName human-readable name for the fallback message (e.g. "Trial gateway")
 * @param {boolean} [opts.isTrialGateway] true ONLY for the trial-gateway adapter. A 429 there means the
 *   free daily allowance ran out (SPEC §4/§9: must trigger the BYOK upsell) — a fundamentally different
 *   situation from a BYOK user's OWN provider quota, which must show a plain message and never the upsell.
 * @returns {EngineError}
 */
export function mapHttpError({ status, bodyMessage, providerName, isTrialGateway = false }) {
  if (status === 401 || status === 403) {
    return new EngineError('auth', bodyMessage || `${providerName} authentication failed (HTTP ${status}).`);
  }
  if (status === 429) {
    const code = isTrialGateway ? 'trial_quota_exhausted' : 'quota';
    return new EngineError(code, bodyMessage || `${providerName} rate limit or quota exceeded (HTTP ${status}).`);
  }
  return new EngineError('gateway_error', bodyMessage || `${providerName} error (HTTP ${status}).`);
}

/**
 * @param {unknown} cause the error `fetch()` itself threw (network failure or abort)
 * @param {string} providerName human-readable name for the fallback message
 * @returns {EngineError}
 */
export function mapNetworkError(cause, providerName) {
  if (cause?.name === 'AbortError' || cause?.name === 'TimeoutError') {
    return new EngineError('timeout', `${providerName} request timed out or was cancelled.`);
  }
  return new EngineError('network', cause?.message || `Network error contacting ${providerName}.`);
}

/**
 * Best-effort JSON error-body message extraction — every provider here
 * follows the near-universal `{error: {message}}` REST convention on
 * failure, but the body may not be JSON at all (e.g. a plain-text 502 from
 * an intermediate proxy), so this never throws.
 * @param {Response} res
 * @returns {Promise<string|undefined>}
 */
export async function extractErrorMessage(res) {
  try {
    const body = await res.json();
    return body?.error?.message;
  } catch {
    return undefined;
  }
}

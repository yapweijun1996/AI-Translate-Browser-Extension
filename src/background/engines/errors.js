// Error codes an engine adapter (or the registry) throws. The worker's
// message handler catches these and maps them into the {ok:false,
// error:{code,message}} envelope (shared/messages.js err()) — this is the
// seam the T-021 central error mapper will expand with provider-specific
// codes (network/auth/quota/trial_quota_exhausted, docs/ARCHITECTURE.md).

export class EngineError extends Error {
  /**
   * @param {string} code stable machine-readable code, e.g. 'no_engine_available'
   * @param {string} message human-readable detail (dev-facing until T-021 adds i18n mapping)
   */
  constructor(code, message) {
    super(message);
    this.name = 'EngineError';
    this.code = code;
  }
}

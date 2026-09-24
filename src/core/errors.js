export class CodeStudioError extends Error {
  constructor(message, { code = 'UNKNOWN_ERROR', cause } = {}) {
    super(message, { cause });
    this.name = 'CodeStudioError';
    this.code = code;
  }
}

export function normalizeError(error, fallback = 'An unexpected error occurred.') {
  if (error instanceof Error) return error;
  return new CodeStudioError(String(error || fallback), { code: 'UNKNOWN_ERROR' });
}

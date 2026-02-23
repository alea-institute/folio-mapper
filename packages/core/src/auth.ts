/**
 * Auth header utilities for API requests.
 *
 * API keys travel via Authorization: Bearer header (not in request body).
 * GitHub PATs travel via X-GitHub-Pat header.
 * Desktop local auth token travels via X-Local-Token header.
 */

let _localToken: string | null = null;

/** Called once on app startup (desktop mode) to store the local auth token. */
export function setLocalToken(token: string): void {
  _localToken = token;
}

/** Returns the local token header if set (for non-JSON requests like FormData). */
export function localTokenHeader(): Record<string, string> {
  const headers: Record<string, string> = {};
  if (_localToken) {
    headers['X-Local-Token'] = _localToken;
  }
  return headers;
}

/** Base headers for API requests: Content-Type + local token (if set). */
export function baseHeaders(): Record<string, string> {
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
  };
  if (_localToken) {
    headers['X-Local-Token'] = _localToken;
  }
  return headers;
}

export function buildAuthHeaders(apiKey?: string | null): Record<string, string> {
  const headers = baseHeaders();
  if (apiKey) {
    headers['Authorization'] = `Bearer ${apiKey}`;
  }
  return headers;
}

export function buildGitHubHeaders(pat: string): Record<string, string> {
  const headers = baseHeaders();
  headers['X-GitHub-Pat'] = pat;
  return headers;
}

const REQUEST_TIMEOUT_MS = 10_000;

export function fetchWithTimeout(url: string | URL | Request, init?: RequestInit) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);
  return fetch(url, { ...init, signal: controller.signal }).finally(() => clearTimeout(timer));
}

/** Build configuration identifies the trusted Worker entry. Never use a query parameter. */
export function parseWorkerAppUrl(value: string | undefined): string | undefined {
  if (!value?.trim()) return undefined;
  const url = new URL(value.trim());
  if (url.protocol !== 'https:' || url.username || url.password || url.search || url.hash) {
    throw new Error('VITE_AEL_APP_URL must be an HTTPS URL without credentials, query, or fragment.');
  }
  return url.href;
}

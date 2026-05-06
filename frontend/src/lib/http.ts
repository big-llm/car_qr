export type ApiRequestOptions = RequestInit & {
  headers?: HeadersInit;
};

export async function parseApiResponse<T = unknown>(response: Response): Promise<T> {
  const rawText = await response.text();
  const contentType = response.headers.get('content-type') || '';
  const fallbackMessage = response.statusText
    ? `${response.status} ${response.statusText}`
    : `Request failed with status ${response.status}`;

  let payload: unknown = null;

  if (rawText.trim()) {
    try {
      payload = JSON.parse(rawText);
    } catch {
      payload = {
        error: contentType.includes('text/html')
          ? `${fallbackMessage}. The server returned an HTML error page instead of JSON.`
          : rawText.trim()
      };
    }
  }

  if (!response.ok) {
    const message =
      typeof payload === 'object' && payload !== null && 'error' in payload
        ? String((payload as { error?: unknown }).error || fallbackMessage)
        : fallbackMessage;
    throw new Error(message);
  }

  return (payload ?? {}) as T;
}

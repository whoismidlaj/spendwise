// Thin fetch wrapper for client components: failed responses become thrown errors with the server's message.
export async function api<T = unknown>(url: string, init?: { method?: string; body?: unknown }): Promise<T> {
  const response = await fetch(url, {
    method: init?.method ?? 'GET',
    ...(init?.body !== undefined ? { headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(init.body) } : {}),
  })
  const data = await response.json().catch(() => ({}))
  if (!response.ok) throw new Error((data as { error?: string }).error || 'Request failed')
  return data as T
}

export function errorMessage(cause: unknown, fallback = 'Something went wrong') {
  return cause instanceof Error ? cause.message : fallback
}

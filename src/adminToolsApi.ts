export type Pin = { message: string; until: string };
export let demoPin: Pin | null = null;
export function setDemoPin(pin: Pin | null) { demoPin = pin; }
export async function adminToolsApi<T>(payload?: Record<string, unknown>, publicOnly = false): Promise<T> {
  const response = await fetch(`/api/admin-tools${publicOnly ? '?public=1' : ''}`, { credentials: 'same-origin', cache: 'no-store', signal: AbortSignal.timeout(15000), ...(payload ? { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(payload) } : {}) });
  const data = await response.json();
  if (!response.ok) throw new Error(data.error || 'Action indisponible. Réessayez.');
  return data;
}

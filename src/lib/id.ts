export function createId(): string {
  if (typeof crypto !== 'undefined' && 'randomUUID' in crypto) {
    return crypto.randomUUID()
  }
  // Fallback simples para ambientes sem crypto.randomUUID.
  return `id-${Date.now()}-${Math.random().toString(16).slice(2)}`
}

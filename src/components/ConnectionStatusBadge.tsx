import type { ConnectionStatus } from '../types'

const STATUS_META: Record<ConnectionStatus, { label: string; dot: string; text: string }> = {
  connected: { label: 'Ligado', dot: 'bg-emerald-500', text: 'text-emerald-400' },
  connecting: { label: 'A ligar…', dot: 'bg-amber-500 animate-pulse', text: 'text-amber-400' },
  reconnecting: {
    label: 'Sem rede — a tentar religar…',
    dot: 'bg-amber-500 animate-pulse',
    text: 'text-amber-400',
  },
  error: { label: 'Erro de ligação', dot: 'bg-red-500', text: 'text-red-400' },
  disconnected: { label: 'Desligado', dot: 'bg-slate-500', text: 'text-slate-400' },
}

export function ConnectionStatusBadge({
  status,
  detail,
}: {
  status: ConnectionStatus
  detail?: string | null
}) {
  const meta = STATUS_META[status]
  return (
    <div className="flex items-center gap-2" title={detail ?? undefined}>
      <span className={`h-2.5 w-2.5 rounded-full ${meta.dot}`} />
      <span className={`text-sm font-medium ${meta.text}`}>{meta.label}</span>
    </div>
  )
}

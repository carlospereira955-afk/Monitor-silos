import type { PollStatus } from '../types'
import { formatRelativeTime } from '../lib/calculations'

interface PollingStatusBadgeProps {
  status: PollStatus
  enabled: boolean
  lastRunAt: number | null
  intervalMinutes: number
}

export function PollingStatusBadge({
  status,
  enabled,
  lastRunAt,
  intervalMinutes,
}: PollingStatusBadgeProps) {
  if (!enabled) {
    return (
      <div className="flex items-center gap-2">
        <span className="h-2.5 w-2.5 rounded-full bg-slate-500" />
        <span className="text-sm font-medium text-slate-400">Atualização pausada</span>
      </div>
    )
  }

  const dotClass =
    status === 'error'
      ? 'bg-red-500'
      : status === 'polling'
        ? 'bg-sky-500 animate-pulse'
        : 'bg-emerald-500'
  const textClass = status === 'error' ? 'text-red-400' : 'text-emerald-400'

  const label =
    status === 'polling'
      ? 'A atualizar…'
      : status === 'error'
        ? 'Erro na atualização'
        : lastRunAt
          ? `Atualizado ${formatRelativeTime(lastRunAt)}`
          : `A cada ${intervalMinutes} min`

  return (
    <div className="flex items-center gap-2" title={`Intervalo: ${intervalMinutes} min`}>
      <span className={`h-2.5 w-2.5 rounded-full ${dotClass}`} />
      <span className={`text-sm font-medium ${textClass}`}>{label}</span>
    </div>
  )
}

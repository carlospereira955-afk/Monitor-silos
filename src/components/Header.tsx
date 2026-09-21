import { useState } from 'react'
import { useAppStore } from '../store/useAppStore'
import { PollingStatusBadge } from './PollingStatusBadge'
import { ConnectionSettings } from './ConnectionSettings'
import { DetectionPanel } from './DetectionPanel'

export function Header() {
  const connectionConfig = useAppStore((s) => s.connectionConfig)
  const httpPollingStatus = useAppStore((s) => s.httpPollingStatus)
  const httpPollingEnabled = useAppStore((s) => s.httpPollingEnabled)
  const httpPollingDetail = useAppStore((s) => s.httpPollingDetail)
  const httpPollingLastRunAt = useAppStore((s) => s.httpPollingLastRunAt)
  const pollIntervalMinutes = useAppStore((s) => s.pollIntervalMinutes)

  const [settingsOpen, setSettingsOpen] = useState(false)
  const [detectionOpen, setDetectionOpen] = useState(false)

  return (
    <header className="sticky top-0 z-40 border-b border-slate-800 bg-slate-950/90 backdrop-blur">
      <div className="mx-auto flex max-w-7xl flex-wrap items-center justify-between gap-3 px-4 py-3">
        <div>
          <h1 className="text-lg font-bold text-slate-50">Monitor de Silos</h1>
          <p className="text-xs text-slate-500">
            {connectionConfig
              ? `Organização ${connectionConfig.organizationId}`
              : 'Nenhuma ligação configurada'}
          </p>
        </div>

        <div className="flex items-center gap-3">
          <PollingStatusBadge
            status={httpPollingStatus}
            enabled={httpPollingEnabled && Boolean(connectionConfig)}
            lastRunAt={httpPollingLastRunAt}
            intervalMinutes={pollIntervalMinutes}
          />
          <button
            type="button"
            onClick={() => setDetectionOpen(true)}
            className="rounded-lg border border-slate-700 px-3 py-1.5 text-xs font-medium text-slate-300 hover:bg-slate-800"
          >
            Detetar sensor
          </button>
          <button
            type="button"
            onClick={() => setSettingsOpen(true)}
            className="rounded-lg bg-sky-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-sky-500"
          >
            Ligação
          </button>
        </div>
      </div>

      {httpPollingStatus === 'error' && httpPollingDetail && (
        <div className="border-t border-red-900/60 bg-red-950/30 px-4 py-2">
          <div className="mx-auto flex max-w-7xl items-start justify-between gap-3">
            <p className="whitespace-pre-wrap break-words text-xs text-red-300">
              {httpPollingDetail}
            </p>
            <button
              type="button"
              onClick={() => setSettingsOpen(true)}
              className="shrink-0 whitespace-nowrap text-xs text-red-200 underline hover:text-red-100"
            >
              Ver detalhes →
            </button>
          </div>
        </div>
      )}

      {settingsOpen && <ConnectionSettings onClose={() => setSettingsOpen(false)} />}
      {detectionOpen && <DetectionPanel onClose={() => setDetectionOpen(false)} />}
    </header>
  )
}

import { useState } from 'react'
import { useAppStore } from '../store/useAppStore'
import { ConnectionStatusBadge } from './ConnectionStatusBadge'
import { ConnectionSettings } from './ConnectionSettings'
import { DetectionPanel } from './DetectionPanel'

export function Header() {
  const connectionStatus = useAppStore((s) => s.connectionStatus)
  const connectionErrorDetail = useAppStore((s) => s.connectionErrorDetail)
  const connectionConfig = useAppStore((s) => s.connectionConfig)

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
          <ConnectionStatusBadge status={connectionStatus} detail={connectionErrorDetail} />
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

      {settingsOpen && <ConnectionSettings onClose={() => setSettingsOpen(false)} />}
      {detectionOpen && <DetectionPanel onClose={() => setDetectionOpen(false)} />}
    </header>
  )
}

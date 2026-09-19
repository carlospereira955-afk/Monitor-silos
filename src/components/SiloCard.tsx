import { useMemo, useState } from 'react'
import type { Silo } from '../types'
import { computeSiloLevel, formatKg, formatRelativeTime } from '../lib/calculations'
import { SiloGauge } from './SiloGauge'
import { SiloEditModal } from './SiloEditModal'
import { CalibrationModal } from './CalibrationModal'
import { ManualReadingModal } from './ManualReadingModal'
import { DetectionPanel } from './DetectionPanel'

const STATUS_LABEL: Record<string, string> = {
  low: 'Nível baixo',
  medium: 'Nível médio',
  full: 'Cheio',
  unknown: 'Sem leitura',
}

const STATUS_BADGE_CLASS: Record<string, string> = {
  low: 'bg-red-950 text-red-300 border-red-800',
  medium: 'bg-amber-950 text-amber-300 border-amber-800',
  full: 'bg-emerald-950 text-emerald-300 border-emerald-800',
  unknown: 'bg-slate-800 text-slate-400 border-slate-700',
}

export function SiloCard({ silo }: { silo: Silo }) {
  const [editOpen, setEditOpen] = useState(false)
  const [calibrateOpen, setCalibrateOpen] = useState(false)
  const [manualOpen, setManualOpen] = useState(false)
  const [detectionDeviceEui, setDetectionDeviceEui] = useState<string | null>(null)

  // Recalcula a cada render (o componente pai re-renderiza a cada leitura MQTT
  // recebida, graças à subscrição zustand no store dos silos).
  const level = useMemo(() => computeSiloLevel(silo), [silo])

  const hasSensor = Boolean(silo.sensor)

  return (
    <div className="rounded-xl border border-slate-800 bg-slate-900/70 p-4 shadow-lg">
      <div className="mb-3 flex items-start justify-between gap-2">
        <div>
          <h3 className="text-base font-semibold text-slate-100">{silo.name}</h3>
          <div className="mt-0.5 flex items-center gap-1.5 text-xs text-slate-500">
            {hasSensor ? (
              <span title={`${silo.sensor?.deviceEui} · canal ${silo.sensor?.channel} · ID ${silo.sensor?.measurementId}`}>
                Sensor associado
              </span>
            ) : (
              <span>Sem sensor — leitura manual</span>
            )}
          </div>
        </div>
        <span
          className={`shrink-0 rounded-full border px-2 py-0.5 text-xs font-medium ${STATUS_BADGE_CLASS[level.status]}`}
        >
          {STATUS_LABEL[level.status]}
        </span>
      </div>

      <div className="flex items-center gap-4">
        <SiloGauge percent={level.percent} status={level.status} isStale={level.isStale} />

        <div className="flex-1 space-y-1.5">
          <div>
            <div className="text-xl font-bold text-slate-50">{formatKg(level.massKg)}</div>
            <div className="text-xs text-slate-500">quantidade estimada</div>
          </div>
          <div className="text-xs text-slate-400">
            Altura de ração: {level.feedHeightMeters.toFixed(2)} m / {silo.heightMeters.toFixed(2)} m
          </div>
          {silo.lastReading ? (
            <div className={`text-xs ${level.isStale ? 'text-amber-400' : 'text-slate-500'}`}>
              Última leitura {formatRelativeTime(silo.lastReading.timestamp)}
              {silo.lastReading.source === 'manual' ? ' (manual)' : ''}
              {level.isStale ? ' — desatualizada' : ''}
            </div>
          ) : (
            <div className="text-xs text-slate-500">Sem leituras registadas</div>
          )}
        </div>
      </div>

      <div className="mt-4 flex flex-wrap gap-2 border-t border-slate-800 pt-3">
        <button
          type="button"
          onClick={() => setEditOpen(true)}
          className="rounded-lg border border-slate-700 px-3 py-1.5 text-xs font-medium text-slate-300 hover:bg-slate-800"
        >
          Configurar
        </button>
        <button
          type="button"
          onClick={() => setManualOpen(true)}
          className="rounded-lg border border-slate-700 px-3 py-1.5 text-xs font-medium text-slate-300 hover:bg-slate-800"
        >
          Leitura manual
        </button>
        <button
          type="button"
          onClick={() => setCalibrateOpen(true)}
          className="rounded-lg border border-slate-700 px-3 py-1.5 text-xs font-medium text-slate-300 hover:bg-slate-800"
        >
          Calibrar
        </button>
      </div>

      {editOpen && (
        <SiloEditModal
          silo={silo}
          onClose={() => setEditOpen(false)}
          onOpenDetection={(eui) => {
            setEditOpen(false)
            setDetectionDeviceEui(eui)
          }}
        />
      )}
      {calibrateOpen && <CalibrationModal silo={silo} onClose={() => setCalibrateOpen(false)} />}
      {manualOpen && <ManualReadingModal silo={silo} onClose={() => setManualOpen(false)} />}
      {detectionDeviceEui !== null && (
        <DetectionPanel
          initialDeviceEui={detectionDeviceEui}
          targetSiloId={silo.id}
          onClose={() => setDetectionDeviceEui(null)}
        />
      )}
    </div>
  )
}

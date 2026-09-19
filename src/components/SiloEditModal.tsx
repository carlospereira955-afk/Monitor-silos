import { useState } from 'react'
import type { Silo } from '../types'
import { useAppStore } from '../store/useAppStore'
import { Modal } from './Modal'

interface SiloEditModalProps {
  silo: Silo
  onClose: () => void
  onOpenDetection: (deviceEui: string) => void
}

function NumberField({
  label,
  value,
  onChange,
  min,
  step = 'any',
  suffix,
}: {
  label: string
  value: number
  onChange: (v: number) => void
  min?: number
  step?: number | 'any'
  suffix?: string
}) {
  return (
    <div>
      <label className="mb-1 block text-sm font-medium text-slate-300">{label}</label>
      <div className="flex items-center gap-2">
        <input
          type="number"
          className="w-full rounded-lg border border-slate-700 bg-slate-800 px-3 py-2 text-sm outline-none focus:border-sky-500"
          value={Number.isFinite(value) ? value : ''}
          min={min}
          step={step}
          onChange={(e) => onChange(e.target.valueAsNumber)}
        />
        {suffix && <span className="w-10 text-xs text-slate-500">{suffix}</span>}
      </div>
    </div>
  )
}

export function SiloEditModal({ silo, onClose, onOpenDetection }: SiloEditModalProps) {
  const updateSilo = useAppStore((s) => s.updateSilo)
  const removeSilo = useAppStore((s) => s.removeSilo)

  const [name, setName] = useState(silo.name)
  const [heightMeters, setHeightMeters] = useState(silo.heightMeters)
  const [diameterMeters, setDiameterMeters] = useState(silo.diameterMeters)
  const [densityKgM3, setDensityKgM3] = useState(silo.densityKgM3)
  const [lowPercent, setLowPercent] = useState(silo.thresholds.lowPercent)
  const [fullPercent, setFullPercent] = useState(silo.thresholds.fullPercent)

  const [deviceEui, setDeviceEui] = useState(silo.sensor?.deviceEui ?? '')
  const [channel, setChannel] = useState(silo.sensor?.channel ?? '')
  const [measurementId, setMeasurementId] = useState(silo.sensor?.measurementId ?? '')

  const [confirmDelete, setConfirmDelete] = useState(false)

  function handleSave() {
    updateSilo(silo.id, {
      name: name.trim() || silo.name,
      heightMeters,
      diameterMeters,
      densityKgM3,
      thresholds: { lowPercent, fullPercent },
      sensor:
        deviceEui.trim() && channel.trim() && measurementId.trim()
          ? { deviceEui: deviceEui.trim(), channel: channel.trim(), measurementId: measurementId.trim() }
          : null,
    })
    onClose()
  }

  return (
    <Modal title={`Configurar — ${silo.name}`} onClose={onClose} widthClass="max-w-lg">
      <div className="space-y-5">
        <div>
          <label className="mb-1 block text-sm font-medium text-slate-300">Nome do silo</label>
          <input
            className="w-full rounded-lg border border-slate-700 bg-slate-800 px-3 py-2 text-sm outline-none focus:border-sky-500"
            value={name}
            onChange={(e) => setName(e.target.value)}
          />
        </div>

        <div className="grid grid-cols-2 gap-3">
          <NumberField
            label="Altura do silo"
            value={heightMeters}
            onChange={setHeightMeters}
            min={0.1}
            suffix="m"
          />
          <NumberField
            label="Diâmetro"
            value={diameterMeters}
            onChange={setDiameterMeters}
            min={0.1}
            suffix="m"
          />
        </div>

        <NumberField
          label="Densidade da ração"
          value={densityKgM3}
          onChange={setDensityKgM3}
          min={1}
          suffix="kg/m³"
        />

        <div className="grid grid-cols-2 gap-3">
          <NumberField
            label="Limiar de nível baixo"
            value={lowPercent}
            onChange={setLowPercent}
            min={0}
            suffix="%"
          />
          <NumberField
            label="Limiar de nível cheio"
            value={fullPercent}
            onChange={setFullPercent}
            min={0}
            suffix="%"
          />
        </div>

        <div className="rounded-lg border border-slate-800 bg-slate-900/60 p-3">
          <div className="mb-2 flex items-center justify-between">
            <h3 className="text-sm font-semibold text-slate-200">Sensor (LoRaWAN)</h3>
            <button
              type="button"
              className="text-xs text-sky-400 hover:underline disabled:cursor-not-allowed disabled:text-slate-600"
              disabled={!deviceEui.trim()}
              onClick={() => onOpenDetection(deviceEui.trim())}
            >
              Detetar measurement ID →
            </button>
          </div>
          <div className="space-y-3">
            <div>
              <label className="mb-1 block text-xs font-medium text-slate-400">Device EUI</label>
              <input
                className="w-full rounded-lg border border-slate-700 bg-slate-800 px-3 py-2 text-sm outline-none focus:border-sky-500"
                value={deviceEui}
                onChange={(e) => setDeviceEui(e.target.value)}
                placeholder="ex.: 2CF7F1C0XXXXXXXX"
              />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="mb-1 block text-xs font-medium text-slate-400">Canal</label>
                <input
                  className="w-full rounded-lg border border-slate-700 bg-slate-800 px-3 py-2 text-sm outline-none focus:border-sky-500"
                  value={channel}
                  onChange={(e) => setChannel(e.target.value)}
                  placeholder="ex.: 4097"
                />
              </div>
              <div>
                <label className="mb-1 block text-xs font-medium text-slate-400">
                  Measurement ID
                </label>
                <input
                  className="w-full rounded-lg border border-slate-700 bg-slate-800 px-3 py-2 text-sm outline-none focus:border-sky-500"
                  value={measurementId}
                  onChange={(e) => setMeasurementId(e.target.value)}
                  placeholder="ex.: 4198"
                />
              </div>
            </div>
          </div>
          <p className="mt-2 text-xs text-slate-500">
            Sem sensor associado, a leitura só pode ser introduzida manualmente.
          </p>
        </div>

        <div className="flex items-center justify-between border-t border-slate-800 pt-4">
          {confirmDelete ? (
            <div className="flex items-center gap-2">
              <span className="text-xs text-red-400">Eliminar este silo?</span>
              <button
                type="button"
                className="rounded-lg bg-red-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-red-500"
                onClick={() => {
                  removeSilo(silo.id)
                  onClose()
                }}
              >
                Confirmar
              </button>
              <button
                type="button"
                className="rounded-lg border border-slate-700 px-3 py-1.5 text-xs text-slate-300 hover:bg-slate-800"
                onClick={() => setConfirmDelete(false)}
              >
                Cancelar
              </button>
            </div>
          ) : (
            <button
              type="button"
              className="text-xs text-red-400 hover:underline"
              onClick={() => setConfirmDelete(true)}
            >
              Eliminar silo
            </button>
          )}

          <div className="flex gap-2">
            <button
              type="button"
              className="rounded-lg border border-slate-700 px-4 py-2 text-sm text-slate-300 hover:bg-slate-800"
              onClick={onClose}
            >
              Cancelar
            </button>
            <button
              type="button"
              className="rounded-lg bg-sky-600 px-4 py-2 text-sm font-medium text-white hover:bg-sky-500"
              onClick={handleSave}
            >
              Guardar
            </button>
          </div>
        </div>
      </div>
    </Modal>
  )
}

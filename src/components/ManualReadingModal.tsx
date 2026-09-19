import { useState } from 'react'
import type { Silo } from '../types'
import { useAppStore } from '../store/useAppStore'
import { Modal } from './Modal'

export function ManualReadingModal({ silo, onClose }: { silo: Silo; onClose: () => void }) {
  const recordManualReading = useAppStore((s) => s.recordManualReading)
  const [rawValueMeters, setRawValueMeters] = useState<number | ''>(
    silo.lastReading?.rawValueMeters ?? '',
  )
  const [error, setError] = useState<string | null>(null)

  function handleSave() {
    if (rawValueMeters === '' || rawValueMeters < 0) {
      setError('Introduza a distância medida (metros) do sensor até à ração.')
      return
    }
    recordManualReading(silo.id, rawValueMeters)
    onClose()
  }

  return (
    <Modal title={`Leitura manual — ${silo.name}`} onClose={onClose}>
      <div className="space-y-4">
        <p className="text-sm text-slate-400">
          Introduza a distância medida pelo radar/sensor até ao topo da ração (o mesmo valor bruto
          que o sensor enviaria por MQTT), em metros. Útil para alternar temporariamente sem
          ligação automática.
        </p>

        <div>
          <label className="mb-1 block text-sm font-medium text-slate-300">
            Distância sensor → ração
          </label>
          <div className="flex items-center gap-2">
            <input
              type="number"
              step="any"
              min={0}
              autoFocus
              className="w-full rounded-lg border border-slate-700 bg-slate-800 px-3 py-2 text-sm outline-none focus:border-sky-500"
              value={rawValueMeters}
              onChange={(e) =>
                setRawValueMeters(e.target.valueAsNumber || (e.target.value === '' ? '' : 0))
              }
              placeholder="ex.: 1.85"
            />
            <span className="w-8 text-xs text-slate-500">m</span>
          </div>
        </div>

        {error && <p className="text-sm text-red-400">{error}</p>}

        <div className="flex justify-end gap-2 border-t border-slate-800 pt-4">
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
            Guardar leitura
          </button>
        </div>
      </div>
    </Modal>
  )
}

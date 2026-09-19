import { useState } from 'react'
import type { Silo } from '../types'
import { useAppStore } from '../store/useAppStore'
import { Modal } from './Modal'
import { formatKg } from '../lib/calculations'

export function CalibrationModal({ silo, onClose }: { silo: Silo; onClose: () => void }) {
  const calibrateSilo = useAppStore((s) => s.calibrateSilo)
  const [knownQuantityKg, setKnownQuantityKg] = useState<number | ''>('')
  const [error, setError] = useState<string | null>(null)
  const [done, setDone] = useState(false)

  const hasReading = Boolean(silo.lastReading)

  function handleConfirm() {
    if (knownQuantityKg === '' || knownQuantityKg < 0) {
      setError('Introduza uma quantidade válida.')
      return
    }
    const ok = calibrateSilo(silo.id, knownQuantityKg)
    if (!ok) {
      setError('Sem leitura do sensor disponível para calibrar. Tente novamente após receber uma leitura.')
      return
    }
    setError(null)
    setDone(true)
  }

  return (
    <Modal title={`Calibrar — ${silo.name}`} onClose={onClose}>
      <div className="space-y-4">
        <p className="text-sm text-slate-400">
          Introduza a quantidade de ração que sabe estar atualmente no silo (por pesagem, guia de
          entrega ou estimativa fiável). A app recalcula o offset de calibração para que a
          leitura atual do sensor passe a corresponder a esta quantidade.
        </p>

        {!hasReading && (
          <div className="rounded-lg border border-amber-800 bg-amber-950/40 p-3 text-sm text-amber-300">
            Ainda não há nenhuma leitura do sensor para este silo. Associe um sensor ou introduza
            uma leitura manual antes de calibrar.
          </div>
        )}

        {done ? (
          <div className="rounded-lg border border-emerald-800 bg-emerald-950/40 p-3 text-sm text-emerald-300">
            Calibração aplicada. Novo offset: {silo.calibrationOffsetMeters.toFixed(3)} m.
          </div>
        ) : (
          <div>
            <label className="mb-1 block text-sm font-medium text-slate-300">
              Quantidade conhecida no silo
            </label>
            <div className="flex items-center gap-2">
              <input
                type="number"
                min={0}
                disabled={!hasReading}
                className="w-full rounded-lg border border-slate-700 bg-slate-800 px-3 py-2 text-sm outline-none focus:border-sky-500 disabled:opacity-50"
                value={knownQuantityKg}
                onChange={(e) =>
                  setKnownQuantityKg(e.target.valueAsNumber || (e.target.value === '' ? '' : 0))
                }
                placeholder="ex.: 4500"
              />
              <span className="w-8 text-xs text-slate-500">kg</span>
            </div>
            {typeof knownQuantityKg === 'number' && knownQuantityKg > 0 && (
              <p className="mt-1 text-xs text-slate-500">≈ {formatKg(knownQuantityKg)}</p>
            )}
          </div>
        )}

        {error && <p className="text-sm text-red-400">{error}</p>}

        <div className="flex justify-end gap-2 border-t border-slate-800 pt-4">
          <button
            type="button"
            className="rounded-lg border border-slate-700 px-4 py-2 text-sm text-slate-300 hover:bg-slate-800"
            onClick={onClose}
          >
            {done ? 'Fechar' : 'Cancelar'}
          </button>
          {!done && (
            <button
              type="button"
              disabled={!hasReading}
              className="rounded-lg bg-sky-600 px-4 py-2 text-sm font-medium text-white hover:bg-sky-500 disabled:cursor-not-allowed disabled:opacity-50"
              onClick={handleConfirm}
            >
              Calibrar
            </button>
          )}
        </div>
      </div>
    </Modal>
  )
}

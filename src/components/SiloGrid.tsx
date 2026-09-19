import { useAppStore } from '../store/useAppStore'
import { SiloCard } from './SiloCard'

export function SiloGrid() {
  const silos = useAppStore((s) => s.silos)
  const addSilo = useAppStore((s) => s.addSilo)

  if (silos.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center rounded-xl border border-dashed border-slate-800 py-16 text-center">
        <p className="mb-4 text-slate-400">Ainda não configurou nenhum silo.</p>
        <button
          type="button"
          onClick={() => addSilo()}
          className="rounded-lg bg-sky-600 px-4 py-2 text-sm font-medium text-white hover:bg-sky-500"
        >
          + Adicionar silo
        </button>
      </div>
    )
  }

  return (
    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-3">
      {silos.map((silo) => (
        <SiloCard key={silo.id} silo={silo} />
      ))}

      <button
        type="button"
        onClick={() => addSilo()}
        className="flex min-h-[220px] items-center justify-center rounded-xl border border-dashed border-slate-700 text-sm font-medium text-slate-400 hover:border-slate-600 hover:text-slate-300"
      >
        + Adicionar silo
      </button>
    </div>
  )
}

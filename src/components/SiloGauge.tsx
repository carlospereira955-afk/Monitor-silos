import type { SiloFillStatus } from '../types'

const STATUS_COLOR: Record<SiloFillStatus, string> = {
  low: '#ef4444',
  medium: '#f59e0b',
  full: '#22c55e',
  unknown: '#475569',
}

interface SiloGaugeProps {
  percent: number
  status: SiloFillStatus
  isStale: boolean
}

/**
 * Representação gráfica simplificada de um silo (corpo cilíndrico + fundo
 * cónico) com o nível de enchimento preenchido proporcionalmente.
 */
export function SiloGauge({ percent, status, isStale }: SiloGaugeProps) {
  const clamped = Math.min(100, Math.max(0, percent))
  const color = STATUS_COLOR[status]

  // Área "útil" do silo dentro do viewBox onde o preenchimento é desenhado.
  const bodyTop = 8
  const bodyBottom = 148 // ponta do cone
  const fillTop = bodyBottom - (clamped / 100) * (bodyBottom - bodyTop)

  return (
    <div className="relative flex flex-col items-center">
      <svg viewBox="0 0 120 170" width="96" height="136" className="drop-shadow-sm">
        <defs>
          <clipPath id="silo-shape">
            <path d="M10 8 H110 V120 L60 158 L10 120 Z" />
          </clipPath>
        </defs>

        {/* Fundo (vazio) */}
        <path
          d="M10 8 H110 V120 L60 158 L10 120 Z"
          fill="#1e293b"
          stroke="#334155"
          strokeWidth="2"
        />

        {/* Preenchimento, recortado à forma do silo */}
        <g clipPath="url(#silo-shape)">
          <rect x="0" y={fillTop} width="120" height={170 - fillTop} fill={color} opacity={isStale ? 0.45 : 0.85} />
        </g>

        {/* Contorno por cima do preenchimento */}
        <path
          d="M10 8 H110 V120 L60 158 L10 120 Z"
          fill="none"
          stroke="#475569"
          strokeWidth="2.5"
        />

        {/* Teto do silo */}
        <path d="M6 8 L60 -8 L114 8 Z" fill="#334155" stroke="#475569" strokeWidth="2" />
      </svg>

      <div className="mt-1 text-center">
        <div className="text-2xl font-bold text-slate-100">{Math.round(clamped)}%</div>
      </div>
    </div>
  )
}

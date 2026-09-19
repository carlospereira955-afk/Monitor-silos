import type { Silo, SiloComputedLevel, SiloFillStatus } from '../types'

/**
 * Uma leitura é considerada desatualizada (stale) se for mais antiga do que isto.
 * Serve para sinalizar na UI que os dados podem já não refletir a realidade,
 * sem impedir a app de continuar a mostrar o último valor conhecido
 * (requisito de funcionamento offline).
 */
export const STALE_THRESHOLD_MS = 30 * 60 * 1000 // 30 minutos

export function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value))
}

/** Área do círculo do silo (m²), a partir do diâmetro. */
export function siloAreaM2(diameterMeters: number): number {
  const radius = diameterMeters / 2
  return Math.PI * radius * radius
}

/**
 * Altura de ração dentro do silo, a partir da leitura bruta do radar (distância
 * ao topo da ração) e do offset de calibração.
 *
 * alturaRacao = alturaSilo - (leituraRadar + offsetCalibracao)
 */
export function feedHeightFromRawReading(
  siloHeightMeters: number,
  rawValueMeters: number,
  calibrationOffsetMeters: number,
): number {
  const height = siloHeightMeters - (rawValueMeters + calibrationOffsetMeters)
  return clamp(height, 0, siloHeightMeters)
}

export function fillStatusFromPercent(
  percent: number,
  thresholds: Silo['thresholds'],
): SiloFillStatus {
  if (percent >= thresholds.fullPercent) return 'full'
  if (percent < thresholds.lowPercent) return 'low'
  return 'medium'
}

/**
 * Calcula todos os valores derivados (altura, volume, massa, percentagem, estado)
 * a partir da configuração do silo e da sua última leitura conhecida.
 *
 * Devolve `status: 'unknown'` e valores a zero quando ainda não há nenhuma leitura.
 */
export function computeSiloLevel(silo: Silo, now: number = Date.now()): SiloComputedLevel {
  if (!silo.lastReading) {
    return {
      feedHeightMeters: 0,
      volumeM3: 0,
      massKg: 0,
      percent: 0,
      status: 'unknown',
      isStale: false,
    }
  }

  const feedHeightMeters = feedHeightFromRawReading(
    silo.heightMeters,
    silo.lastReading.rawValueMeters,
    silo.calibrationOffsetMeters,
  )
  const volumeM3 = siloAreaM2(silo.diameterMeters) * feedHeightMeters
  const massKg = volumeM3 * silo.densityKgM3
  const percent =
    silo.heightMeters > 0 ? clamp((feedHeightMeters / silo.heightMeters) * 100, 0, 100) : 0
  const status = fillStatusFromPercent(percent, silo.thresholds)
  const isStale = now - silo.lastReading.timestamp > STALE_THRESHOLD_MS

  return { feedHeightMeters, volumeM3, massKg, percent, status, isStale }
}

/**
 * Calcula o novo offset de calibração de forma a que a leitura atual do sensor
 * corresponda à quantidade conhecida (em kg) introduzida pelo utilizador.
 *
 * Passos:
 *  1. A partir da massa conhecida, deriva a altura de ração "real": h = massa / (densidade * área)
 *  2. offset = alturaSilo - leituraBruta - hReal
 *
 * Devolve `null` se não houver leitura bruta disponível para calibrar contra ela,
 * ou se os dados do silo forem insuficientes (densidade/diâmetro <= 0).
 */
export function calibrateOffsetFromKnownQuantity(
  silo: Silo,
  knownQuantityKg: number,
): number | null {
  if (!silo.lastReading) return null
  if (silo.densityKgM3 <= 0 || silo.diameterMeters <= 0) return null

  const area = siloAreaM2(silo.diameterMeters)
  const targetHeightMeters = knownQuantityKg / (silo.densityKgM3 * area)
  const cappedTargetHeight = clamp(targetHeightMeters, 0, silo.heightMeters)

  const newOffset = silo.heightMeters - silo.lastReading.rawValueMeters - cappedTargetHeight
  return newOffset
}

export function kgToDisplay(kg: number): { value: number; unit: 'kg' | 't' } {
  if (kg >= 1000) {
    return { value: kg / 1000, unit: 't' }
  }
  return { value: kg, unit: 'kg' }
}

export function formatKg(kg: number): string {
  const { value, unit } = kgToDisplay(kg)
  const decimals = unit === 't' ? 2 : 0
  return `${value.toLocaleString('pt-PT', {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  })} ${unit}`
}

export function formatPercent(percent: number): string {
  return `${percent.toLocaleString('pt-PT', { maximumFractionDigits: 0 })}%`
}

export function formatRelativeTime(timestamp: number, now: number = Date.now()): string {
  const diffMs = now - timestamp
  if (diffMs < 0) return 'agora'
  const diffSec = Math.floor(diffMs / 1000)
  if (diffSec < 10) return 'agora mesmo'
  if (diffSec < 60) return `há ${diffSec}s`
  const diffMin = Math.floor(diffSec / 60)
  if (diffMin < 60) return `há ${diffMin} min`
  const diffHour = Math.floor(diffMin / 60)
  if (diffHour < 24) return `há ${diffHour} h`
  const diffDay = Math.floor(diffHour / 24)
  return `há ${diffDay} dia${diffDay > 1 ? 's' : ''}`
}

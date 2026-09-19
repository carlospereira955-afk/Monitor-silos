/**
 * Tipos centrais da aplicação de monitorização de silos.
 */

/** Origem de uma leitura de nível. */
export type ReadingSource = 'mqtt' | 'manual'

/** Estado de ligação ao broker MQTT da SenseCraft. */
export type ConnectionStatus =
  | 'disconnected' // nunca ligado, ou ligação terminada pelo utilizador
  | 'connecting'
  | 'connected'
  | 'reconnecting' // perdeu ligação e está a tentar restabelecer
  | 'error'

/** Credenciais / configuração de ligação à plataforma SenseCraft. */
export interface ConnectionConfig {
  organizationId: string
  accessApiKey: string
  /** Permite substituir o host por omissão, se necessário (debug/proxy). */
  brokerUrl?: string
}

/** Última leitura conhecida de um silo (bruta, em metros, tal como veio do radar). */
export interface LastReading {
  /** Valor bruto devolvido pelo sensor (distância medida pelo radar), em metros. */
  rawValueMeters: number
  /** Timestamp epoch (ms) da leitura. */
  timestamp: number
  source: ReadingSource
}

/** Configuração e estado de um silo individual. */
export interface Silo {
  id: string
  name: string

  /** Dimensões físicas do silo. */
  heightMeters: number
  diameterMeters: number

  /** Densidade da ração armazenada (kg/m³), editável por silo/tipo de ração. */
  densityKgM3: number

  /** Offset de calibração (metros), somado à leitura bruta do radar. */
  calibrationOffsetMeters: number

  /** Associação ao sensor LoRaWAN na SenseCraft. */
  sensor: {
    deviceEui: string
    channel: string
    measurementId: string
  } | null

  /** Limiares de estado (percentagem 0-100) — permite ajustar por silo. */
  thresholds: {
    lowPercent: number // abaixo disto -> "baixo"
    fullPercent: number // acima disto -> "cheio"
  }

  lastReading: LastReading | null

  createdAt: number
  updatedAt: number
}

/** Estado de preenchimento calculado a partir de um Silo + a sua última leitura. */
export type SiloFillStatus = 'low' | 'medium' | 'full' | 'unknown'

export interface SiloComputedLevel {
  /** Altura de ração dentro do silo, em metros (limitada a [0, heightMeters]). */
  feedHeightMeters: number
  /** Volume ocupado, em m³. */
  volumeM3: number
  /** Massa estimada, em kg. */
  massKg: number
  /** Percentagem de enchimento, 0-100. */
  percent: number
  status: SiloFillStatus
  /** Indica se a leitura usada está desatualizada (ver STALE_THRESHOLD_MS). */
  isStale: boolean
}

/** Amostra recebida em modo de deteção (para identificar o measurementId certo). */
export interface DetectedSample {
  key: string // deviceEui/channel/wildcard/measurementId
  deviceEui: string
  channel: string
  measurementId: string
  value: string
  timestamp: number
  receivedAt: number
}

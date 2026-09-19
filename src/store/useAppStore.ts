import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import type {
  ConnectionConfig,
  ConnectionStatus,
  DetectedSample,
  Silo,
} from '../types'
import { createId } from '../lib/id'
import { mqttClient } from '../mqtt/client'
import { buildDeviceDiscoveryTopic, buildSiloTopic, parsePayload, parseTopic } from '../mqtt/topics'
import { calibrateOffsetFromKnownQuantity } from '../lib/calculations'

const MAX_DETECTED_SAMPLES = 200

function nowIso() {
  return Date.now()
}

export function defaultThresholds() {
  return { lowPercent: 20, fullPercent: 85 }
}

export function createEmptySilo(name: string): Silo {
  const ts = nowIso()
  return {
    id: createId(),
    name,
    heightMeters: 6,
    diameterMeters: 3,
    densityKgM3: 600, // aproximação razoável para ração composta/farinha
    calibrationOffsetMeters: 0,
    sensor: null,
    thresholds: defaultThresholds(),
    lastReading: null,
    createdAt: ts,
    updatedAt: ts,
  }
}

interface AppState {
  // --- Ligação ---
  connectionConfig: ConnectionConfig | null
  connectionStatus: ConnectionStatus
  connectionErrorDetail: string | null
  mqttInitialized: boolean

  // --- Silos ---
  silos: Silo[]

  // --- Modo de deteção ---
  detection: {
    active: boolean
    deviceEui: string | null
    /** samples indexados por "channel/measurementId" -> última amostra */
    samples: Record<string, DetectedSample>
  }

  // --- Ações: ligação ---
  setConnectionConfig: (config: ConnectionConfig) => void
  connect: () => void
  disconnect: () => void
  initMqttListeners: () => void

  // --- Ações: silos ---
  addSilo: (name?: string) => string
  updateSilo: (id: string, patch: Partial<Omit<Silo, 'id' | 'createdAt'>>) => void
  removeSilo: (id: string) => void
  recordManualReading: (id: string, rawValueMeters: number) => void
  calibrateSilo: (id: string, knownQuantityKg: number) => boolean

  // --- Ações: deteção ---
  startDetection: (deviceEui: string) => void
  stopDetection: () => void
  clearDetectionSamples: () => void

  // --- Internas ---
  _resyncMqttSubscriptions: () => void
}

export const useAppStore = create<AppState>()(
  persist(
    (set, get) => ({
      connectionConfig: null,
      connectionStatus: 'disconnected',
      connectionErrorDetail: null,
      mqttInitialized: false,

      silos: [],

      detection: {
        active: false,
        deviceEui: null,
        samples: {},
      },

      setConnectionConfig: (config) => {
        set({ connectionConfig: config })
      },

      connect: () => {
        const config = get().connectionConfig
        if (!config || !config.organizationId || !config.accessApiKey) return
        mqttClient.connect(config)
        // Subscrever assim que possível (o cliente guarda subscrições e
        // aplica-as em cada "connect"/"reconnect").
        get()._resyncMqttSubscriptions()
      },

      disconnect: () => {
        mqttClient.disconnect()
      },

      initMqttListeners: () => {
        if (get().mqttInitialized) return
        set({ mqttInitialized: true })

        mqttClient.onStatusChange((status, detail) => {
          set({ connectionStatus: status, connectionErrorDetail: detail ?? null })
        })

        mqttClient.onMessage((topic, payload) => {
          const parsedTopic = parseTopic(topic)
          const parsedPayload = parsePayload(payload)
          if (!parsedTopic || !parsedPayload) return

          const rawValueMeters = Number(parsedPayload.value)
          if (Number.isNaN(rawValueMeters)) return

          const timestamp = Number(parsedPayload.timestamp) || Date.now()

          const { deviceEui, channel, measurementId } = parsedTopic

          // 1) Modo de deteção: regista qualquer amostra do dispositivo em foco.
          const detection = get().detection
          if (detection.active && detection.deviceEui === deviceEui) {
            const key = `${channel}/${measurementId}`
            set((state) => {
              const nextSamples = { ...state.detection.samples }
              nextSamples[key] = {
                key,
                deviceEui,
                channel,
                measurementId,
                value: parsedPayload.value,
                timestamp,
                receivedAt: Date.now(),
              }
              // Limita o nº de entradas guardadas para não crescer indefinidamente.
              const keys = Object.keys(nextSamples)
              if (keys.length > MAX_DETECTED_SAMPLES) {
                delete nextSamples[keys[0]]
              }
              return { detection: { ...state.detection, samples: nextSamples } }
            })
          }

          // 2) Silos configurados com este sensor exato: atualiza a leitura.
          const matchingSilos = get().silos.filter(
            (s) =>
              s.sensor &&
              s.sensor.deviceEui === deviceEui &&
              s.sensor.channel === channel &&
              s.sensor.measurementId === measurementId,
          )
          if (matchingSilos.length > 0) {
            set((state) => ({
              silos: state.silos.map((s) =>
                matchingSilos.some((m) => m.id === s.id)
                  ? {
                      ...s,
                      lastReading: { rawValueMeters, timestamp, source: 'mqtt' },
                      updatedAt: Date.now(),
                    }
                  : s,
              ),
            }))
          }
        })
      },

      addSilo: (name) => {
        const silo = createEmptySilo(name?.trim() || `Silo ${get().silos.length + 1}`)
        set((state) => ({ silos: [...state.silos, silo] }))
        return silo.id
      },

      updateSilo: (id, patch) => {
        set((state) => ({
          silos: state.silos.map((s) =>
            s.id === id ? { ...s, ...patch, updatedAt: Date.now() } : s,
          ),
        }))
        get()._resyncMqttSubscriptions()
      },

      removeSilo: (id) => {
        set((state) => ({ silos: state.silos.filter((s) => s.id !== id) }))
        get()._resyncMqttSubscriptions()
      },

      recordManualReading: (id, rawValueMeters) => {
        set((state) => ({
          silos: state.silos.map((s) =>
            s.id === id
              ? {
                  ...s,
                  lastReading: { rawValueMeters, timestamp: Date.now(), source: 'manual' },
                  updatedAt: Date.now(),
                }
              : s,
          ),
        }))
      },

      calibrateSilo: (id, knownQuantityKg) => {
        const silo = get().silos.find((s) => s.id === id)
        if (!silo) return false
        const newOffset = calibrateOffsetFromKnownQuantity(silo, knownQuantityKg)
        if (newOffset === null) return false

        set((state) => ({
          silos: state.silos.map((s) =>
            s.id === id
              ? { ...s, calibrationOffsetMeters: newOffset, updatedAt: Date.now() }
              : s,
          ),
        }))
        return true
      },

      startDetection: (deviceEui) => {
        set({ detection: { active: true, deviceEui, samples: {} } })
        get()._resyncMqttSubscriptions()
      },

      stopDetection: () => {
        set((state) => ({ detection: { ...state.detection, active: false, deviceEui: null } }))
        get()._resyncMqttSubscriptions()
      },

      clearDetectionSamples: () => {
        set((state) => ({ detection: { ...state.detection, samples: {} } }))
      },

      _resyncMqttSubscriptions: () => {
        const config = get().connectionConfig
        if (!config?.organizationId) return

        const topics = new Set<string>()

        for (const silo of get().silos) {
          if (silo.sensor?.deviceEui && silo.sensor.channel && silo.sensor.measurementId) {
            topics.add(
              buildSiloTopic({
                organizationId: config.organizationId,
                deviceEui: silo.sensor.deviceEui,
                channel: silo.sensor.channel,
                measurementId: silo.sensor.measurementId,
              }),
            )
          }
        }

        const detection = get().detection
        if (detection.active && detection.deviceEui) {
          topics.add(buildDeviceDiscoveryTopic(config.organizationId, detection.deviceEui))
        }

        mqttClient.syncTopics(Array.from(topics))
      },
    }),
    {
      name: 'monitor-silos-storage',
      // Apenas persistimos configuração + silos (inclui últimas leituras,
      // essencial para a app continuar a mostrar dados com a rede em baixo).
      // Estado de deteção e de ligação MQTT são transitórios.
      partialize: (state) => ({
        connectionConfig: state.connectionConfig,
        silos: state.silos,
      }),
      version: 1,
    },
  ),
)

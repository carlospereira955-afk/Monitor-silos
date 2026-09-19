import mqtt, { type MqttClient } from 'mqtt'
import type { ConnectionConfig, ConnectionStatus } from '../types'

export const DEFAULT_BROKER_URL = 'wss://sensecap-openstream.seeed.cc:8083/mqtt'

export type MessageHandler = (topic: string, payload: string) => void
export type StatusHandler = (status: ConnectionStatus, detail?: string) => void

/**
 * Gestor da ligação MQTT/WebSocket à SenseCraft.
 *
 * Responsabilidades:
 *  - Ligar/desligar com as credenciais da organização.
 *  - Reconectar automaticamente em caso de queda de rede (o local de
 *    instalação pode ficar sem internet durante períodos longos — a app
 *    deve tentar recuperar sozinha quando a rede volta, sem intervenção).
 *  - Gerir subscrições por tópico, permitindo adicionar/remover silos e o
 *    modo de deteção sem reiniciar a ligação.
 */
export class SenseCraftMqttClient {
  private client: MqttClient | null = null
  private subscribedTopics = new Set<string>()
  private statusHandlers = new Set<StatusHandler>()
  private messageHandlers = new Set<MessageHandler>()
  private currentStatus: ConnectionStatus = 'disconnected'

  getStatus(): ConnectionStatus {
    return this.currentStatus
  }

  onStatusChange(handler: StatusHandler): () => void {
    this.statusHandlers.add(handler)
    return () => this.statusHandlers.delete(handler)
  }

  onMessage(handler: MessageHandler): () => void {
    this.messageHandlers.add(handler)
    return () => this.messageHandlers.delete(handler)
  }

  private setStatus(status: ConnectionStatus, detail?: string) {
    this.currentStatus = status
    this.statusHandlers.forEach((h) => h(status, detail))
  }

  connect(config: ConnectionConfig) {
    this.disconnect()

    const url = config.brokerUrl?.trim() || DEFAULT_BROKER_URL
    this.setStatus('connecting')

    try {
      this.client = mqtt.connect(url, {
        username: `org-${config.organizationId}`,
        password: config.accessApiKey,
        clean: true,
        reconnectPeriod: 5000, // tenta reconectar a cada 5s indefinidamente
        connectTimeout: 15000,
        keepalive: 30,
      })
    } catch (err) {
      this.setStatus('error', err instanceof Error ? err.message : String(err))
      return
    }

    this.client.on('connect', () => {
      this.setStatus('connected')
      // Re-subscrever tudo ao (re)ligar, incluindo depois de reconexões.
      if (this.subscribedTopics.size > 0) {
        this.client?.subscribe(Array.from(this.subscribedTopics), (err) => {
          if (err) this.setStatus('error', err.message)
        })
      }
    })

    this.client.on('reconnect', () => {
      this.setStatus('reconnecting')
    })

    this.client.on('close', () => {
      if (this.currentStatus !== 'disconnected') {
        this.setStatus('reconnecting')
      }
    })

    this.client.on('offline', () => {
      this.setStatus('reconnecting')
    })

    this.client.on('error', (err) => {
      this.setStatus('error', err instanceof Error ? err.message : String(err))
    })

    this.client.on('message', (topic, payloadBuf) => {
      const payload = payloadBuf.toString()
      this.messageHandlers.forEach((h) => h(topic, payload))
    })
  }

  disconnect() {
    if (this.client) {
      this.client.end(true)
      this.client = null
    }
    this.setStatus('disconnected')
  }

  isConnected(): boolean {
    return this.client?.connected ?? false
  }

  subscribe(topic: string) {
    this.subscribedTopics.add(topic)
    if (this.client?.connected) {
      this.client.subscribe(topic, (err) => {
        if (err) this.setStatus('error', err.message)
      })
    }
  }

  unsubscribe(topic: string) {
    this.subscribedTopics.delete(topic)
    if (this.client?.connected) {
      this.client.unsubscribe(topic)
    }
  }

  /** Substitui o conjunto de tópicos subscritos pelo indicado (diff mínimo). */
  syncTopics(topics: string[]) {
    const next = new Set(topics)

    for (const topic of this.subscribedTopics) {
      if (!next.has(topic)) this.unsubscribe(topic)
    }
    for (const topic of next) {
      if (!this.subscribedTopics.has(topic)) this.subscribe(topic)
    }
  }
}

/** Instância única partilhada por toda a aplicação. */
export const mqttClient = new SenseCraftMqttClient()

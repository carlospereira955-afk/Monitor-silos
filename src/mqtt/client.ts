import mqtt, { type MqttClient } from 'mqtt'
import type { ConnectionConfig, ConnectionStatus } from '../types'

export const DEFAULT_BROKER_URL = 'wss://sensecap-openstream.seeed.cc:8083/mqtt'

export type MessageHandler = (topic: string, payload: string) => void
export type StatusHandler = (status: ConnectionStatus, detail?: string) => void

/**
 * Gera um sufixo aleatório curto (letras minúsculas + dígitos), tal como a
 * documentação da SenseCraft exige para a parte "aleatória" do clientId.
 */
function randomSuffix(length = 8): string {
  const chars = 'abcdefghijklmnopqrstuvwxyz0123456789'
  let out = ''
  for (let i = 0; i < length; i++) {
    out += chars[Math.floor(Math.random() * chars.length)]
  }
  return out
}

/**
 * Constrói o clientId no formato exigido pela SenseCraft OpenStream API:
 * `org-<OrganizationID>-<IDAleatório>`.
 *
 * Isto é fundamental: o MQTT.js gera por omissão um clientId genérico
 * (`mqttjs_xxxxxxxx`) que não corresponde a este formato. Em brokers
 * geridos (tipicamente EMQX) com um plugin de autenticação/ACL associado
 * ao Organization ID, um clientId fora do formato esperado é rejeitado
 * imediatamente — o que no browser aparece como o WebSocket a fechar-se
 * antes da ligação ficar estabelecida, sem mensagem de erro explícita.
 */
export function buildClientId(organizationId: string): string {
  return `org-${organizationId}-${randomSuffix()}`
}

/** Mapeia códigos de retorno do CONNACK do MQTT 3.1.1 para texto legível. */
const CONNACK_RETURN_CODES: Record<number, string> = {
  1: 'Versão de protocolo MQTT não aceite pelo broker (protocolVersion incorreto).',
  2: 'Identificador de cliente (clientId) rejeitado pelo broker.',
  3: 'Servidor MQTT indisponível.',
  4: 'Username ou password (Access API Key) incorretos.',
  5: 'Não autorizado — credenciais válidas mas sem permissão para este recurso/tópico.',
}

function describeError(err: unknown): string {
  if (!(err instanceof Error)) return String(err)
  // mqtt.js anexa por vezes um código de retorno do CONNACK ao erro.
  const code = (err as Error & { code?: number }).code
  const known = typeof code === 'number' ? CONNACK_RETURN_CODES[code] : undefined
  return known ? `${err.message} (código ${code}: ${known})` : err.message
}

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
 *  - Expor o máximo de detalhe possível sobre falhas de ligação (o browser
 *    esconde por segurança quase toda a informação de erro/close nativa do
 *    WebSocket, por isso sintetizamos um diagnóstico útil quando o mqtt.js
 *    não nos dá mais nada).
 */
export class SenseCraftMqttClient {
  private client: MqttClient | null = null
  private subscribedTopics = new Set<string>()
  private statusHandlers = new Set<StatusHandler>()
  private messageHandlers = new Set<MessageHandler>()
  private currentStatus: ConnectionStatus = 'disconnected'
  private lastErrorMessage: string | null = null
  private hasConnectedOnce = false
  private lastClientId: string | null = null

  getStatus(): ConnectionStatus {
    return this.currentStatus
  }

  /** O clientId usado na tentativa de ligação atual/mais recente (para depuração). */
  getLastClientId(): string | null {
    return this.lastClientId
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
    const clientId = buildClientId(config.organizationId)
    this.lastClientId = clientId
    this.lastErrorMessage = null
    this.hasConnectedOnce = false
    this.setStatus('connecting', `A ligar como ${clientId}…`)

    try {
      this.client = mqtt.connect(url, {
        username: `org-${config.organizationId}`,
        password: config.accessApiKey,
        clientId,
        protocolVersion: config.protocolVersion ?? 4, // 4 = MQTT 3.1.1
        clean: true,
        reconnectPeriod: 5000, // tenta reconectar a cada 5s indefinidamente
        connectTimeout: 15000,
        keepalive: 30,
      })
    } catch (err) {
      const message = describeError(err)
      this.lastErrorMessage = message
      this.setStatus('error', message)
      return
    }

    this.client.on('connect', () => {
      this.hasConnectedOnce = true
      this.lastErrorMessage = null
      this.setStatus('connected')
      // Re-subscrever tudo ao (re)ligar, incluindo depois de reconexões.
      if (this.subscribedTopics.size > 0) {
        this.client?.subscribe(Array.from(this.subscribedTopics), (err) => {
          if (err) {
            const message = describeError(err)
            this.lastErrorMessage = message
            this.setStatus('error', message)
          }
        })
      }
    })

    this.client.on('reconnect', () => {
      this.setStatus('reconnecting', this.lastErrorMessage ?? undefined)
    })

    this.client.on('close', () => {
      if (this.currentStatus === 'disconnected') return // terminado pelo utilizador

      const detail =
        this.lastErrorMessage ??
        (!this.hasConnectedOnce
          ? `O WebSocket fechou-se antes de a ligação MQTT ficar estabelecida (clientId usado: ${clientId}). ` +
            'Isto acontece tipicamente quando o broker rejeita o CONNECT — Organization ID, Access API Key, ' +
            'clientId ou protocolVersion incorretos — sem que o browser exponha mais detalhe sobre o fecho ' +
            'do WebSocket nativo, por razões de segurança. Confirme as credenciais com o botão "Testar ' +
            'credenciais" (usa a API REST, que devolve o motivo exato) e verifique o URL/porta do broker.'
          : 'Ligação ao broker perdida (rede em baixo ou o broker fechou a ligação). A tentar reconectar automaticamente…')

      this.lastErrorMessage = detail
      this.setStatus(this.hasConnectedOnce ? 'reconnecting' : 'error', detail)
    })

    this.client.on('offline', () => {
      this.setStatus('reconnecting', this.lastErrorMessage ?? undefined)
    })

    this.client.on('error', (err) => {
      const message = describeError(err)
      this.lastErrorMessage = message
      this.setStatus('error', message)
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
        if (err) this.setStatus('error', describeError(err))
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

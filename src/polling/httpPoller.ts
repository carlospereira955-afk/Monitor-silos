import type { ConnectionConfig, PollStatus, Silo } from '../types'
import { fetchLatestTelemetry } from '../api/senseCraftHttp'

export type PollStatusHandler = (status: PollStatus, detail?: string) => void
export type PollReadingHandler = (siloId: string, rawValueMeters: number, timestamp: number) => void

const MIN_INTERVAL_MINUTES = 0.05 // 3s — só para permitir testar rapidamente; a UI sugere minutos inteiros

/**
 * Atualiza o dashboard automaticamente através de pedidos HTTP periódicos
 * ao endpoint `view_latest_telemetry_data` da SenseCraft, em vez de depender
 * de uma ligação MQTT/WebSocket persistente (mais frágil de manter viva a
 * partir do browser, sobretudo em dispositivos móveis que suspendem
 * ligações em segundo plano).
 *
 * Para cada silo com um sensor associado, faz um pedido GET independente a
 * cada intervalo configurado. Silos sem sensor são ignorados (ficam por
 * leitura manual).
 */
export class SenseCraftHttpPoller {
  private intervalId: ReturnType<typeof setInterval> | null = null
  private statusHandlers = new Set<PollStatusHandler>()
  private readingHandlers = new Set<PollReadingHandler>()
  private currentStatus: PollStatus = 'idle'
  private inFlight = false

  getStatus(): PollStatus {
    return this.currentStatus
  }

  onStatusChange(handler: PollStatusHandler): () => void {
    this.statusHandlers.add(handler)
    return () => this.statusHandlers.delete(handler)
  }

  onReading(handler: PollReadingHandler): () => void {
    this.readingHandlers.add(handler)
    return () => this.readingHandlers.delete(handler)
  }

  private setStatus(status: PollStatus, detail?: string) {
    this.currentStatus = status
    this.statusHandlers.forEach((h) => h(status, detail))
  }

  /**
   * Inicia (ou reinicia, se já ativo) o polling periódico. `getConfig` e
   * `getSilos` são lidos a cada tick, para refletirem sempre o estado mais
   * recente do store sem ser preciso reiniciar manualmente a cada alteração
   * de silos.
   */
  start(
    getConfig: () => ConnectionConfig | null,
    getSilos: () => Silo[],
    intervalMinutes: number,
  ) {
    this.stop()

    const tick = async () => {
      if (this.inFlight) return // evita sobrepor ciclos se um pedido demorar mais que o intervalo
      const config = getConfig()
      if (!config?.organizationId?.trim() || !config?.accessApiKey?.trim()) {
        this.setStatus('idle', 'Sem credenciais configuradas.')
        return
      }

      const silosWithSensor = getSilos().filter((s) => s.sensor)
      if (silosWithSensor.length === 0) {
        this.setStatus('idle', 'Nenhum silo tem sensor associado.')
        return
      }

      this.inFlight = true
      this.setStatus('polling')
      const errors: string[] = []

      for (const silo of silosWithSensor) {
        try {
          const result = await fetchLatestTelemetry(config, silo.sensor!)
          if (result.ok && result.rawValue !== undefined) {
            this.readingHandlers.forEach((h) =>
              h(silo.id, result.rawValue!, result.timestamp ?? Date.now()),
            )
          } else {
            errors.push(`${silo.name}: ${result.message}`)
          }
        } catch (err) {
          errors.push(`${silo.name}: ${err instanceof Error ? err.message : String(err)}`)
        }
      }

      this.inFlight = false
      this.setStatus(errors.length > 0 ? 'error' : 'idle', errors.join(' · ') || undefined)
    }

    // Primeiro ciclo imediato, para não esperar um intervalo inteiro ao ligar.
    void tick()
    const ms = Math.max(MIN_INTERVAL_MINUTES, intervalMinutes) * 60_000
    this.intervalId = setInterval(() => void tick(), ms)
  }

  stop() {
    if (this.intervalId) {
      clearInterval(this.intervalId)
      this.intervalId = null
    }
    this.setStatus('idle')
  }

  isRunning(): boolean {
    return this.intervalId !== null
  }
}

/** Instância única partilhada por toda a aplicação. */
export const httpPoller = new SenseCraftHttpPoller()

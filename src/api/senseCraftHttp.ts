import type { ConnectionConfig } from '../types'

/**
 * Host da API HTTP da SenseCAP — um domínio DIFERENTE do usado para MQTT
 * (`sensecap-openstream.seeed.cc`, só para WebSocket/MQTT). Confirmado por
 * testar em produção: `sensecap-openstream.seeed.cc` na porta HTTPS normal
 * não responde (ERR_CONNECTION_TIMED_OUT) — não há ali nenhuma API HTTP.
 * Ver: https://sensecap-docs.seeed.cc/httpapi_quickstart.html
 */
export const DEFAULT_HTTP_API_HOST = 'https://sensecap-openapi.seeed.cc'

function resolveApiHost(config: Pick<ConnectionConfig, 'httpApiHost'>): string {
  return config.httpApiHost?.trim() || DEFAULT_HTTP_API_HOST
}

function basicAuthHeader(organizationId: string, accessApiKey: string): string {
  return `Basic ${btoa(`org-${organizationId}:${accessApiKey}`)}`
}

export interface CredentialsTestResult {
  ok: boolean
  /** Estado HTTP devolvido, se o pedido chegou a ter resposta. */
  httpStatus?: number
  /** Mensagem legível para mostrar ao utilizador. */
  message: string
  /** Corpo da resposta (para diagnóstico avançado), se disponível. */
  raw?: unknown
}

/**
 * Testa as credenciais (Organization ID + Access API Key) fazendo um pedido
 * HTTP simples com Basic Auth ao endpoint `view_latest_telemetry_data` da
 * API REST da SenseCraft — a mesma autenticação usada no MQTT (username
 * `org-<OrgID>`, password = Access API Key), mas por HTTP, o que permite
 * isolar problemas de credenciais de problemas específicos do WebSocket/MQTT.
 *
 * `device_eui` é opcional: o endpoint exige-o para devolver dados reais,
 * mas mesmo sem ele a resposta já distingue "credenciais inválidas" (401/403)
 * de "credenciais válidas, faltam parâmetros" (200 com corpo JSON de erro).
 */
export async function testSenseCraftCredentials(
  config: Pick<ConnectionConfig, 'organizationId' | 'accessApiKey' | 'httpApiHost'>,
  deviceEui?: string,
): Promise<CredentialsTestResult> {
  const organizationId = config.organizationId.trim()
  const accessApiKey = config.accessApiKey.trim()

  if (!organizationId || !accessApiKey) {
    return { ok: false, message: 'Preencha o Organization ID e a Access API Key primeiro.' }
  }

  const apiHost = resolveApiHost(config)
  const url = new URL('/view_latest_telemetry_data', apiHost)
  if (deviceEui?.trim()) {
    url.searchParams.set('device_eui', deviceEui.trim())
  }

  let response: Response
  try {
    response = await fetch(url.toString(), {
      method: 'GET',
      headers: {
        Authorization: basicAuthHeader(organizationId, accessApiKey),
        Accept: 'application/json',
      },
    })
  } catch (err) {
    // O browser não distingue, por segurança, um bloqueio de CORS de um
    // erro de rede genérico — ambos chegam aqui como "Failed to fetch".
    const detail = err instanceof Error ? err.message : String(err)
    return {
      ok: false,
      message:
        `Não foi possível contactar ${apiHost} a partir do browser (${detail}). ` +
        'Isto pode ser falta de rede, ou a API não permitir pedidos diretos do browser (sem ' +
        'cabeçalhos CORS) — nesse caso, o teste tem de ser feito fora do browser (ex.: curl) para ' +
        'validar as credenciais.',
    }
  }

  let body: unknown = null
  const text = await response.text()
  try {
    body = text ? JSON.parse(text) : null
  } catch {
    body = text
  }

  if (response.status === 401 || response.status === 403) {
    return {
      ok: false,
      httpStatus: response.status,
      message: `Credenciais rejeitadas pela SenseCraft (HTTP ${response.status}). Confirme o Organization ID e a Access API Key.`,
      raw: body,
    }
  }

  if (!response.ok) {
    return {
      ok: false,
      httpStatus: response.status,
      message: `A API respondeu com HTTP ${response.status}: ${typeof body === 'string' ? body : JSON.stringify(body)}`,
      raw: body,
    }
  }

  // HTTP 200: as credenciais foram aceites. O campo "code" da SenseCraft
  // pode ainda assim indicar um erro de parâmetros (ex.: device_eui em falta),
  // o que não invalida a autenticação — só significa que faltam dados para
  // devolver uma leitura real.
  const code = (body as { code?: string | number } | null)?.code
  const isApiError = code !== undefined && String(code) !== '0'

  if (isApiError) {
    return {
      ok: true,
      httpStatus: response.status,
      message:
        'Credenciais válidas — a SenseCraft autenticou o pedido. ' +
        `A API devolveu um erro de parâmetros (código ${code}), esperado sem um Device EUI válido.`,
      raw: body,
    }
  }

  return {
    ok: true,
    httpStatus: response.status,
    message: 'Credenciais válidas — a SenseCraft devolveu dados com sucesso.',
    raw: body,
  }
}

// --- Leitura periódica de telemetria (polling) ---------------------------

interface TelemetryPoint {
  measurement_value: number
  measurement_id: string
  time: string
}

interface TelemetryChannel {
  channel_index: number
  points: TelemetryPoint[]
}

interface TelemetryResponse {
  code: string
  data?: TelemetryChannel[]
  msg?: string
}

export interface SensorRef {
  deviceEui: string
  channel: string
  measurementId: string
}

export interface TelemetryReadingResult {
  ok: boolean
  /** Valor bruto devolvido pelo sensor (assume-se metros, tal como no MQTT). */
  rawValue?: number
  /** Timestamp da leitura (epoch ms). Cai para "agora" se a API não o der num formato reconhecido. */
  timestamp?: number
  httpStatus?: number
  message: string
}

/**
 * Vai buscar a leitura mais recente de um sensor específico (device EUI +
 * canal + measurement ID) ao endpoint `view_latest_telemetry_data`.
 *
 * Usado pelo polling automático que atualiza o dashboard — em alternativa
 * à ligação MQTT/WebSocket persistente, que é mais frágil de manter viva
 * a partir do browser. O MQTT continua a ser usado apenas no modo de
 * deteção de sensor, que precisa mesmo de dados em tempo real.
 */
export async function fetchLatestTelemetry(
  config: Pick<ConnectionConfig, 'organizationId' | 'accessApiKey' | 'httpApiHost'>,
  sensor: SensorRef,
): Promise<TelemetryReadingResult> {
  const organizationId = config.organizationId.trim()
  const accessApiKey = config.accessApiKey.trim()
  if (!organizationId || !accessApiKey) {
    return { ok: false, message: 'Sem credenciais configuradas.' }
  }
  if (!sensor.deviceEui.trim()) {
    return { ok: false, message: 'Sem Device EUI associado a este silo.' }
  }

  const apiHost = resolveApiHost(config)
  const url = new URL('/view_latest_telemetry_data', apiHost)
  url.searchParams.set('device_eui', sensor.deviceEui.trim())
  if (sensor.measurementId.trim()) {
    url.searchParams.set('measurement_id', sensor.measurementId.trim())
  }
  const channelIndex = sensor.channel.trim() ? Number(sensor.channel.trim()) : undefined
  if (channelIndex !== undefined && Number.isFinite(channelIndex)) {
    url.searchParams.set('channel_index', String(channelIndex))
  }

  let response: Response
  try {
    response = await fetch(url.toString(), {
      method: 'GET',
      headers: {
        Authorization: basicAuthHeader(organizationId, accessApiKey),
        Accept: 'application/json',
      },
    })
  } catch (err) {
    const detail = err instanceof Error ? err.message : String(err)
    return { ok: false, message: `Falha de rede ao contactar ${apiHost}: ${detail}` }
  }

  const text = await response.text()
  let body: TelemetryResponse | null = null
  try {
    body = text ? (JSON.parse(text) as TelemetryResponse) : null
  } catch {
    return {
      ok: false,
      httpStatus: response.status,
      message: `Resposta inesperada (não é JSON válido): ${text.slice(0, 200)}`,
    }
  }

  if (response.status === 401 || response.status === 403) {
    return {
      ok: false,
      httpStatus: response.status,
      message: `Credenciais rejeitadas pela SenseCraft (HTTP ${response.status}).`,
    }
  }

  if (!response.ok) {
    return {
      ok: false,
      httpStatus: response.status,
      message: `HTTP ${response.status}${body?.msg ? `: ${body.msg}` : ''}`,
    }
  }

  if (!body || String(body.code) !== '0') {
    return {
      ok: false,
      httpStatus: response.status,
      message: body?.msg ? `Erro da API (código ${body.code}): ${body.msg}` : `Erro da API (código ${body?.code}).`,
    }
  }

  // Procura o ponto cujo measurement_id corresponde ao configurado —
  // dentro do canal certo, se soubermos qual é; senão em todos os canais
  // devolvidos.
  for (const ch of body.data ?? []) {
    if (channelIndex !== undefined && Number.isFinite(channelIndex) && ch.channel_index !== channelIndex) {
      continue
    }
    for (const point of ch.points ?? []) {
      if (String(point.measurement_id) === sensor.measurementId.trim()) {
        const parsedTime = Date.parse(point.time)
        return {
          ok: true,
          rawValue: Number(point.measurement_value),
          timestamp: Number.isFinite(parsedTime) ? parsedTime : Date.now(),
          httpStatus: response.status,
          message: 'Leitura obtida com sucesso.',
        }
      }
    }
  }

  return {
    ok: false,
    httpStatus: response.status,
    message: `A API respondeu sem dados para o measurement ID ${sensor.measurementId} deste device EUI.`,
  }
}

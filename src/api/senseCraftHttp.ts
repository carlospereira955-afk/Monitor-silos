import type { ConnectionConfig } from '../types'

/**
 * Host da API HTTP (Data OpenStream) da SenseCraft — o mesmo domínio usado
 * para MQTT, mas em HTTPS normal (porta 443, sem "/mqtt").
 * Ver: https://sensecap-docs.seeed.cc/data_openstream_reference.html
 */
export const DEFAULT_HTTP_API_HOST = 'https://sensecap-openstream.seeed.cc'

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
  config: Pick<ConnectionConfig, 'organizationId' | 'accessApiKey'>,
  deviceEui?: string,
): Promise<CredentialsTestResult> {
  const organizationId = config.organizationId.trim()
  const accessApiKey = config.accessApiKey.trim()

  if (!organizationId || !accessApiKey) {
    return { ok: false, message: 'Preencha o Organization ID e a Access API Key primeiro.' }
  }

  const url = new URL('/view_latest_telemetry_data', DEFAULT_HTTP_API_HOST)
  if (deviceEui?.trim()) {
    url.searchParams.set('device_eui', deviceEui.trim())
  }

  const username = `org-${organizationId}`
  const basicAuth = btoa(`${username}:${accessApiKey}`)

  let response: Response
  try {
    response = await fetch(url.toString(), {
      method: 'GET',
      headers: {
        Authorization: `Basic ${basicAuth}`,
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
        `Não foi possível contactar ${DEFAULT_HTTP_API_HOST} a partir do browser (${detail}). ` +
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

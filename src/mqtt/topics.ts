/**
 * Utilitários para construir e interpretar os tópicos MQTT da SenseCraft.
 *
 * Formato documentado:
 *   /device_sensor_data/<OrgID>/<DeviceEUI>/<Channel>/+/<MeasurementID>
 *
 * O segmento representado por "+" na documentação corresponde ao tipo de
 * medição/sub-índice interno da SenseCraft, que não controlamos — por isso
 * subscrevemos sempre com "+" nesse lugar.
 */

export interface TopicParts {
  organizationId: string
  deviceEui: string
  channel: string
  measurementId: string
}

/** Tópico exato para subscrever um silo já identificado (measurementId conhecido). */
export function buildSiloTopic(parts: TopicParts): string {
  const { organizationId, deviceEui, channel, measurementId } = parts
  return `/device_sensor_data/${organizationId}/${deviceEui}/${channel}/+/${measurementId}`
}

/**
 * Tópico "aberto" para modo de deteção: recebe todas as medições de um
 * dispositivo (todos os canais e measurementIds), para o utilizador conseguir
 * identificar visualmente qual corresponde ao sensor de distância/radar.
 */
export function buildDeviceDiscoveryTopic(organizationId: string, deviceEui: string): string {
  return `/device_sensor_data/${organizationId}/${deviceEui}/#`
}

export interface ParsedTopic {
  organizationId: string
  deviceEui: string
  channel: string
  measurementId: string
}

/**
 * Faz parsing de um tópico recebido (que pode ter mais segmentos do que o
 * padrão de subscrição, devido ao "#"/"+") para extrair device, canal e
 * measurementId.
 *
 * Espera-se o formato: /device_sensor_data/<org>/<eui>/<channel>/<sub>/<measurementId>
 * mas alguns dispositivos podem emitir com um número diferente de segmentos
 * finais — por isso o parsing é tolerante: canal = 4º segmento,
 * measurementId = último segmento.
 */
export function parseTopic(topic: string): ParsedTopic | null {
  const segments = topic.split('/').filter(Boolean)
  // segments: ["device_sensor_data", org, eui, channel, ...sub, measurementId]
  if (segments.length < 5) return null
  const [prefix, organizationId, deviceEui, channel] = segments
  if (prefix !== 'device_sensor_data') return null
  const measurementId = segments[segments.length - 1]

  return { organizationId, deviceEui, channel, measurementId }
}

export interface SenseCraftPayload {
  value: string
  timestamp: string
}

export function parsePayload(raw: string): SenseCraftPayload | null {
  try {
    const parsed = JSON.parse(raw)
    if (typeof parsed?.value === 'string' && typeof parsed?.timestamp === 'string') {
      return parsed as SenseCraftPayload
    }
    // Alguns dispositivos podem enviar números em vez de strings — normaliza.
    if (parsed?.value !== undefined && parsed?.timestamp !== undefined) {
      return { value: String(parsed.value), timestamp: String(parsed.timestamp) }
    }
    return null
  } catch {
    return null
  }
}

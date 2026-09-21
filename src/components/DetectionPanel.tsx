import { useEffect, useState } from 'react'
import { useAppStore } from '../store/useAppStore'
import { Modal } from './Modal'
import { formatRelativeTime } from '../lib/calculations'

interface DetectionPanelProps {
  initialDeviceEui?: string
  onClose: () => void
  /** Se indicado, mostra um botão para aplicar o measurementId escolhido a este silo. */
  targetSiloId?: string
}

export function DetectionPanel({ initialDeviceEui, onClose, targetSiloId }: DetectionPanelProps) {
  const [deviceEui, setDeviceEui] = useState(initialDeviceEui ?? '')
  const detection = useAppStore((s) => s.detection)
  const startDetection = useAppStore((s) => s.startDetection)
  const stopDetection = useAppStore((s) => s.stopDetection)
  const clearDetectionSamples = useAppStore((s) => s.clearDetectionSamples)
  const connectionStatus = useAppStore((s) => s.connectionStatus)
  const connectionConfig = useAppStore((s) => s.connectionConfig)
  const connect = useAppStore((s) => s.connect)
  const disconnect = useAppStore((s) => s.disconnect)
  const updateSilo = useAppStore((s) => s.updateSilo)
  const silos = useAppStore((s) => s.silos)

  const targetSilo = targetSiloId ? silos.find((s) => s.id === targetSiloId) : undefined

  useEffect(() => {
    // O MQTT deixou de ligar automaticamente ao abrir a app — só é preciso
    // para este modo de deteção em tempo real, por isso liga-se aqui, e
    // desliga-se novamente ao sair, para não manter uma ligação persistente
    // aberta sem necessidade.
    if (connectionConfig?.organizationId && connectionConfig?.accessApiKey) {
      connect()
    }
    return () => {
      // Ao fechar o painel, para a deteção para não manter uma subscrição
      // "aberta" (#) indefinidamente a consumir tráfego desnecessário.
      stopDetection()
      disconnect()
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const samples = Object.values(detection.samples).sort((a, b) => b.receivedAt - a.receivedAt)

  function handleStart() {
    if (!deviceEui.trim()) return
    clearDetectionSamples()
    startDetection(deviceEui.trim())
  }

  function handleApply(channel: string, measurementId: string) {
    if (!targetSiloId) return
    updateSilo(targetSiloId, {
      sensor: { deviceEui: deviceEui.trim(), channel, measurementId },
    })
    onClose()
  }

  return (
    <Modal title="Deteção de sensor" onClose={onClose} widthClass="max-w-2xl">
      <div className="space-y-4">
        <p className="text-sm text-slate-400">
          Introduza o Device EUI do sensor e inicie a deteção. A app subscreve todas as medições
          desse dispositivo durante alguns instantes, para identificar visualmente qual
          measurement ID corresponde ao sensor de distância/radar (normalmente o valor que varia
          de forma coerente com o nível de enchimento).
        </p>

        {connectionStatus === 'connecting' && (
          <div className="rounded-lg border border-amber-800 bg-amber-950/40 p-3 text-sm text-amber-300">
            A ligar à SenseCraft…
          </div>
        )}
        {(connectionStatus === 'disconnected' ||
          connectionStatus === 'error' ||
          connectionStatus === 'reconnecting') && (
          <div className="rounded-lg border border-amber-800 bg-amber-950/40 p-3 text-sm text-amber-300">
            É necessário estar ligado à SenseCraft para detetar sensores em tempo real.
          </div>
        )}

        <div className="flex items-end gap-2">
          <div className="flex-1">
            <label className="mb-1 block text-sm font-medium text-slate-300">Device EUI</label>
            <input
              className="w-full rounded-lg border border-slate-700 bg-slate-800 px-3 py-2 text-sm outline-none focus:border-sky-500"
              value={deviceEui}
              onChange={(e) => setDeviceEui(e.target.value)}
              placeholder="ex.: 2CF7F1C0XXXXXXXX"
              disabled={detection.active}
            />
          </div>
          {detection.active ? (
            <button
              type="button"
              onClick={stopDetection}
              className="rounded-lg border border-slate-700 px-4 py-2 text-sm text-slate-300 hover:bg-slate-800"
            >
              Parar
            </button>
          ) : (
            <button
              type="button"
              disabled={!deviceEui.trim() || connectionStatus !== 'connected'}
              onClick={handleStart}
              className="rounded-lg bg-sky-600 px-4 py-2 text-sm font-medium text-white hover:bg-sky-500 disabled:cursor-not-allowed disabled:opacity-50"
            >
              Iniciar deteção
            </button>
          )}
        </div>

        {detection.active && (
          <div className="flex items-center gap-2 text-sm text-emerald-400">
            <span className="h-2 w-2 animate-pulse rounded-full bg-emerald-500" />
            A escutar mensagens de {detection.deviceEui}…
          </div>
        )}

        <div className="rounded-lg border border-slate-800">
          <table className="w-full text-left text-sm">
            <thead className="border-b border-slate-800 text-xs uppercase text-slate-500">
              <tr>
                <th className="px-3 py-2">Canal</th>
                <th className="px-3 py-2">Measurement ID</th>
                <th className="px-3 py-2">Último valor</th>
                <th className="px-3 py-2">Recebido</th>
                {targetSiloId && <th className="px-3 py-2" />}
              </tr>
            </thead>
            <tbody>
              {samples.length === 0 ? (
                <tr>
                  <td colSpan={targetSiloId ? 5 : 4} className="px-3 py-6 text-center text-slate-500">
                    {detection.active
                      ? 'Sem mensagens recebidas ainda…'
                      : 'Inicie a deteção para ver as medições do dispositivo.'}
                  </td>
                </tr>
              ) : (
                samples.map((sample) => (
                  <tr key={sample.key} className="border-b border-slate-800/60 last:border-0">
                    <td className="px-3 py-2 font-mono text-xs text-slate-300">{sample.channel}</td>
                    <td className="px-3 py-2 font-mono text-xs text-slate-300">
                      {sample.measurementId}
                    </td>
                    <td className="px-3 py-2 font-mono text-slate-100">{sample.value}</td>
                    <td className="px-3 py-2 text-xs text-slate-500">
                      {formatRelativeTime(sample.receivedAt)}
                    </td>
                    {targetSiloId && (
                      <td className="px-3 py-2">
                        <button
                          type="button"
                          className="text-xs text-sky-400 hover:underline"
                          onClick={() => handleApply(sample.channel, sample.measurementId)}
                        >
                          Usar em {targetSilo?.name ?? 'silo'}
                        </button>
                      </td>
                    )}
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        <p className="text-xs text-slate-500">
          Dica: aproxime ou afaste um objeto do sensor e observe qual measurement ID muda de
          forma proporcional — esse é normalmente o sensor de distância/radar.
        </p>
      </div>
    </Modal>
  )
}

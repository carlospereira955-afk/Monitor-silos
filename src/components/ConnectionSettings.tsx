import { useState } from 'react'
import { useAppStore } from '../store/useAppStore'
import { Modal } from './Modal'
import { DEFAULT_BROKER_URL, mqttClient } from '../mqtt/client'
import { DEFAULT_HTTP_API_HOST, testSenseCraftCredentials, type CredentialsTestResult } from '../api/senseCraftHttp'

const POLL_STATUS_LABEL: Record<string, string> = {
  idle: 'Em dia',
  polling: 'A atualizar…',
  error: 'Erro na última atualização',
}

export function ConnectionSettings({ onClose }: { onClose: () => void }) {
  const connectionConfig = useAppStore((s) => s.connectionConfig)
  const setConnectionConfig = useAppStore((s) => s.setConnectionConfig)
  const pollIntervalMinutes = useAppStore((s) => s.pollIntervalMinutes)
  const setPollIntervalMinutes = useAppStore((s) => s.setPollIntervalMinutes)
  const httpPollingEnabled = useAppStore((s) => s.httpPollingEnabled)
  const httpPollingStatus = useAppStore((s) => s.httpPollingStatus)
  const httpPollingDetail = useAppStore((s) => s.httpPollingDetail)
  const startHttpPolling = useAppStore((s) => s.startHttpPolling)
  const stopHttpPolling = useAppStore((s) => s.stopHttpPolling)
  const silosWithSensor = useAppStore((s) => s.silos.filter((silo) => silo.sensor).length)

  const connectionErrorDetail = useAppStore((s) => s.connectionErrorDetail)

  const [organizationId, setOrganizationId] = useState(connectionConfig?.organizationId ?? '')
  const [accessApiKey, setAccessApiKey] = useState(connectionConfig?.accessApiKey ?? '')
  const [pollMinutesInput, setPollMinutesInput] = useState(String(pollIntervalMinutes))
  const [brokerUrl, setBrokerUrl] = useState(connectionConfig?.brokerUrl ?? '')
  const [httpApiHost, setHttpApiHost] = useState(connectionConfig?.httpApiHost ?? '')
  const [protocolVersion, setProtocolVersion] = useState<4 | 5>(
    connectionConfig?.protocolVersion ?? 4,
  )
  const [showAdvanced, setShowAdvanced] = useState(
    Boolean(connectionConfig?.brokerUrl || connectionConfig?.httpApiHost || connectionConfig?.protocolVersion === 5),
  )
  const [showKey, setShowKey] = useState(false)

  const [testDeviceEui, setTestDeviceEui] = useState('')
  const [testing, setTesting] = useState(false)
  const [testResult, setTestResult] = useState<CredentialsTestResult | null>(null)

  const canSave = organizationId.trim().length > 0 && accessApiKey.trim().length > 0

  function handleSave() {
    setConnectionConfig({
      organizationId: organizationId.trim(),
      accessApiKey: accessApiKey.trim(),
      brokerUrl: brokerUrl.trim() || undefined,
      httpApiHost: httpApiHost.trim() || undefined,
      protocolVersion,
    })
    const minutes = Number(pollMinutesInput)
    setPollIntervalMinutes(Number.isFinite(minutes) && minutes > 0 ? minutes : pollIntervalMinutes)
  }

  async function handleTestCredentials() {
    setTesting(true)
    setTestResult(null)
    try {
      const result = await testSenseCraftCredentials(
        {
          organizationId: organizationId.trim(),
          accessApiKey: accessApiKey.trim(),
          httpApiHost: httpApiHost.trim() || undefined,
        },
        testDeviceEui,
      )
      setTestResult(result)
    } finally {
      setTesting(false)
    }
  }

  return (
    <Modal title="Ligação à SenseCraft" onClose={onClose}>
      <div className="space-y-4">
        <p className="text-sm text-slate-400">
          Introduza o Organization ID e a Access API Key criados em{' '}
          <span className="text-slate-300">SenseCraft → Security → Access API Keys</span>. O
          dashboard atualiza-se sozinho a partir daqui, por pedidos HTTP periódicos — não precisa
          de nenhuma ligação persistente aberta.
        </p>

        <div>
          <label className="mb-1 block text-sm font-medium text-slate-300">
            Organization ID
          </label>
          <input
            className="w-full rounded-lg border border-slate-700 bg-slate-800 px-3 py-2 text-sm outline-none focus:border-sky-500"
            value={organizationId}
            onChange={(e) => setOrganizationId(e.target.value)}
            placeholder="ex.: 123456"
            autoComplete="off"
          />
        </div>

        <div>
          <label className="mb-1 block text-sm font-medium text-slate-300">
            Access API Key
          </label>
          <div className="flex gap-2">
            <input
              className="w-full rounded-lg border border-slate-700 bg-slate-800 px-3 py-2 text-sm outline-none focus:border-sky-500"
              type={showKey ? 'text' : 'password'}
              value={accessApiKey}
              onChange={(e) => setAccessApiKey(e.target.value)}
              placeholder="chave de acesso"
              autoComplete="off"
            />
            <button
              type="button"
              onClick={() => setShowKey((v) => !v)}
              className="shrink-0 rounded-lg border border-slate-700 px-3 text-xs text-slate-300 hover:bg-slate-800"
            >
              {showKey ? 'Ocultar' : 'Mostrar'}
            </button>
          </div>
          <p className="mt-1 text-xs text-slate-500">
            Guardada apenas neste dispositivo (armazenamento local do navegador).
          </p>
        </div>

        <div>
          <label className="mb-1 block text-sm font-medium text-slate-300">
            Intervalo de atualização automática
          </label>
          <div className="flex items-center gap-2">
            <input
              type="number"
              min={0.1}
              step="any"
              className="w-28 rounded-lg border border-slate-700 bg-slate-800 px-3 py-2 text-sm outline-none focus:border-sky-500"
              value={pollMinutesInput}
              onChange={(e) => setPollMinutesInput(e.target.value)}
            />
            <span className="text-xs text-slate-500">minutos, por silo com sensor associado</span>
          </div>
        </div>

        <div className="rounded-lg border border-slate-800 bg-slate-900/60 p-3 text-xs text-slate-400">
          <div className="mb-1 flex items-center justify-between">
            <span className="font-semibold text-slate-200">Atualização automática</span>
            <span
              className={
                httpPollingStatus === 'error' ? 'text-red-400' : 'text-slate-400'
              }
            >
              {POLL_STATUS_LABEL[httpPollingStatus] ?? httpPollingStatus}
            </span>
          </div>
          <p>
            {silosWithSensor} silo{silosWithSensor === 1 ? '' : 's'} com sensor associado
            {httpPollingEnabled ? '' : ' — pausada'}.
          </p>
          {httpPollingDetail && (
            <p className="mt-1 whitespace-pre-wrap break-words text-slate-500">
              {httpPollingDetail}
            </p>
          )}
          <div className="mt-2">
            {httpPollingEnabled ? (
              <button
                type="button"
                onClick={stopHttpPolling}
                className="text-xs text-sky-400 hover:underline"
              >
                Pausar atualização automática
              </button>
            ) : (
              <button
                type="button"
                onClick={startHttpPolling}
                disabled={!canSave}
                className="text-xs text-sky-400 hover:underline disabled:cursor-not-allowed disabled:text-slate-600"
              >
                Retomar atualização automática
              </button>
            )}
          </div>
        </div>

        {/* Teste de credenciais via HTTP (Basic Auth) */}
        <div className="rounded-lg border border-slate-800 bg-slate-900/60 p-3">
          <h3 className="mb-2 text-sm font-semibold text-slate-200">Testar credenciais</h3>
          <p className="mb-2 text-xs text-slate-500">
            Faz um pedido HTTP simples (Basic Auth) ao endpoint{' '}
            <code className="text-slate-400">view_latest_telemetry_data</code> da API REST da
            SenseCraft — o mesmo endpoint usado na atualização automática.
          </p>
          <div className="flex items-end gap-2">
            <div className="flex-1">
              <label className="mb-1 block text-xs font-medium text-slate-400">
                Device EUI (opcional)
              </label>
              <input
                className="w-full rounded-lg border border-slate-700 bg-slate-800 px-3 py-2 text-sm outline-none focus:border-sky-500"
                value={testDeviceEui}
                onChange={(e) => setTestDeviceEui(e.target.value)}
                placeholder="ex.: 2CF7F1C0XXXXXXXX"
              />
            </div>
            <button
              type="button"
              disabled={!canSave || testing}
              onClick={handleTestCredentials}
              className="shrink-0 rounded-lg bg-slate-700 px-3 py-2 text-xs font-medium text-white hover:bg-slate-600 disabled:cursor-not-allowed disabled:opacity-50"
            >
              {testing ? 'A testar…' : 'Testar credenciais'}
            </button>
          </div>
          {testResult && (
            <div
              className={`mt-2 rounded-lg border p-2 text-xs ${
                testResult.ok
                  ? 'border-emerald-800 bg-emerald-950/40 text-emerald-300'
                  : 'border-red-800 bg-red-950/40 text-red-300'
              }`}
            >
              <p className="whitespace-pre-wrap break-words">{testResult.message}</p>
              {testResult.httpStatus !== undefined && (
                <p className="mt-1 text-slate-500">HTTP {testResult.httpStatus}</p>
              )}
            </div>
          )}
        </div>

        <button
          type="button"
          className="text-xs text-sky-400 hover:underline"
          onClick={() => setShowAdvanced((v) => !v)}
        >
          {showAdvanced ? 'Ocultar opções avançadas' : 'Opções avançadas'}
        </button>

        {showAdvanced && (
          <div className="space-y-3">
            <div>
              <label className="mb-1 block text-sm font-medium text-slate-300">
                URL da API HTTP (opcional)
              </label>
              <input
                className="w-full rounded-lg border border-slate-700 bg-slate-800 px-3 py-2 text-sm outline-none focus:border-sky-500"
                value={httpApiHost}
                onChange={(e) => setHttpApiHost(e.target.value)}
                placeholder={DEFAULT_HTTP_API_HOST}
              />
              <p className="mt-1 text-xs text-slate-500">
                Usada pela atualização automática e pelo teste de credenciais. Só é preciso mudar
                para depuração ou para apontar a um servidor de testes.
              </p>
            </div>

            <div className="border-t border-slate-800 pt-3">
              <p className="mb-2 text-xs font-semibold text-slate-300">
                MQTT (usado apenas pelo modo de deteção de sensor)
              </p>

              <label className="mb-1 block text-sm font-medium text-slate-300">
                URL do broker (opcional)
              </label>
              <input
                className="w-full rounded-lg border border-slate-700 bg-slate-800 px-3 py-2 text-sm outline-none focus:border-sky-500"
                value={brokerUrl}
                onChange={(e) => setBrokerUrl(e.target.value)}
                placeholder={DEFAULT_BROKER_URL}
              />
            </div>

            <div>
              <label className="mb-1 block text-sm font-medium text-slate-300">
                Versão do protocolo MQTT
              </label>
              <div className="flex gap-4 text-sm text-slate-300">
                <label className="flex items-center gap-1.5">
                  <input
                    type="radio"
                    checked={protocolVersion === 4}
                    onChange={() => setProtocolVersion(4)}
                  />
                  3.1.1 (recomendado)
                </label>
                <label className="flex items-center gap-1.5">
                  <input
                    type="radio"
                    checked={protocolVersion === 5}
                    onChange={() => setProtocolVersion(5)}
                  />
                  MQTT 5
                </label>
              </div>
            </div>

            <p className="text-xs text-slate-500">
              URL do broker efetivamente usado:{' '}
              <code className="text-slate-400">
                {mqttClient.getLastBrokerUrl() ?? (brokerUrl.trim() || DEFAULT_BROKER_URL)}
              </code>
            </p>
            <p className="text-xs text-slate-500">
              Client ID usado na ligação:{' '}
              <code className="text-slate-400">
                {mqttClient.getLastClientId() ?? `org-${organizationId || '<OrgID>'}-<aleatório>`}
              </code>{' '}
              (gerado automaticamente no formato exigido pela SenseCraft).
            </p>
          </div>
        )}

        {connectionErrorDetail && (
          <div className="rounded-lg border border-red-800 bg-red-950/30 p-3">
            <h3 className="mb-1 text-xs font-semibold text-red-300">
              Última mensagem de erro do MQTT.js (modo de deteção)
            </h3>
            <p className="whitespace-pre-wrap break-words text-xs text-red-300/90">
              {connectionErrorDetail}
            </p>
          </div>
        )}

        <div className="flex items-center justify-end gap-2 pt-2">
          <button
            type="button"
            className="rounded-lg border border-slate-700 px-4 py-2 text-sm text-slate-300 hover:bg-slate-800"
            onClick={onClose}
          >
            Fechar
          </button>
          <button
            type="button"
            disabled={!canSave}
            onClick={() => {
              handleSave()
              onClose()
            }}
            className="rounded-lg bg-sky-600 px-4 py-2 text-sm font-medium text-white hover:bg-sky-500 disabled:cursor-not-allowed disabled:opacity-50"
          >
            Guardar
          </button>
        </div>
      </div>
    </Modal>
  )
}

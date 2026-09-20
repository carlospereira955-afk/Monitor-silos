import { useState } from 'react'
import { useAppStore } from '../store/useAppStore'
import { Modal } from './Modal'
import { DEFAULT_BROKER_URL, mqttClient } from '../mqtt/client'
import { testSenseCraftCredentials, type CredentialsTestResult } from '../api/senseCraftHttp'

export function ConnectionSettings({ onClose }: { onClose: () => void }) {
  const connectionConfig = useAppStore((s) => s.connectionConfig)
  const setConnectionConfig = useAppStore((s) => s.setConnectionConfig)
  const connect = useAppStore((s) => s.connect)
  const disconnect = useAppStore((s) => s.disconnect)
  const connectionStatus = useAppStore((s) => s.connectionStatus)
  const connectionErrorDetail = useAppStore((s) => s.connectionErrorDetail)

  const [organizationId, setOrganizationId] = useState(connectionConfig?.organizationId ?? '')
  const [accessApiKey, setAccessApiKey] = useState(connectionConfig?.accessApiKey ?? '')
  const [brokerUrl, setBrokerUrl] = useState(connectionConfig?.brokerUrl ?? '')
  const [protocolVersion, setProtocolVersion] = useState<4 | 5>(
    connectionConfig?.protocolVersion ?? 4,
  )
  const [showAdvanced, setShowAdvanced] = useState(
    Boolean(connectionConfig?.brokerUrl || connectionConfig?.protocolVersion === 5),
  )
  const [showKey, setShowKey] = useState(false)

  const [testDeviceEui, setTestDeviceEui] = useState('')
  const [testing, setTesting] = useState(false)
  const [testResult, setTestResult] = useState<CredentialsTestResult | null>(null)

  const canSave = organizationId.trim().length > 0 && accessApiKey.trim().length > 0

  function handleSaveAndConnect() {
    setConnectionConfig({
      organizationId: organizationId.trim(),
      accessApiKey: accessApiKey.trim(),
      brokerUrl: brokerUrl.trim() || undefined,
      protocolVersion,
    })
    // connect() lê o estado atualizado do store na próxima tick; garantimos
    // a ordem chamando-o depois do set síncrono do zustand.
    setTimeout(() => connect(), 0)
  }

  async function handleTestCredentials() {
    setTesting(true)
    setTestResult(null)
    try {
      const result = await testSenseCraftCredentials(
        { organizationId: organizationId.trim(), accessApiKey: accessApiKey.trim() },
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
          <span className="text-slate-300">SenseCraft → Security → Access API Keys</span>.
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

        {/* Teste de credenciais via HTTP (Basic Auth), isolado do MQTT/WebSocket */}
        <div className="rounded-lg border border-slate-800 bg-slate-900/60 p-3">
          <h3 className="mb-2 text-sm font-semibold text-slate-200">Testar credenciais</h3>
          <p className="mb-2 text-xs text-slate-500">
            Faz um pedido HTTP simples (Basic Auth) ao endpoint{' '}
            <code className="text-slate-400">view_latest_telemetry_data</code> da API REST da
            SenseCraft, para confirmar se o Organization ID e a Access API Key estão corretos —
            sem depender da ligação MQTT/WebSocket.
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
                URL do broker (opcional)
              </label>
              <input
                className="w-full rounded-lg border border-slate-700 bg-slate-800 px-3 py-2 text-sm outline-none focus:border-sky-500"
                value={brokerUrl}
                onChange={(e) => setBrokerUrl(e.target.value)}
                placeholder={DEFAULT_BROKER_URL}
              />
              <p className="mt-1 text-xs text-slate-500">
                Documentado como porta 8083 (wss). Se a ligação falhar com "WebSocket fechado
                antes de estabelecido", experimente confirmar com a SenseCraft se a porta correta
                é esta ou 8084, antes de mudar aqui.
              </p>
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
              Última mensagem de erro do MQTT.js
            </h3>
            <p className="whitespace-pre-wrap break-words text-xs text-red-300/90">
              {connectionErrorDetail}
            </p>
          </div>
        )}

        <div className="flex items-center justify-between gap-2 pt-2">
          <button
            type="button"
            onClick={() => {
              disconnect()
            }}
            className="rounded-lg border border-slate-700 px-3 py-2 text-sm text-slate-300 hover:bg-slate-800"
            disabled={connectionStatus === 'disconnected'}
          >
            Desligar
          </button>
          <button
            type="button"
            disabled={!canSave}
            onClick={() => {
              handleSaveAndConnect()
              onClose()
            }}
            className="rounded-lg bg-sky-600 px-4 py-2 text-sm font-medium text-white hover:bg-sky-500 disabled:cursor-not-allowed disabled:opacity-50"
          >
            Guardar e ligar
          </button>
        </div>
      </div>
    </Modal>
  )
}

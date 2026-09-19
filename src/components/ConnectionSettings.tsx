import { useState } from 'react'
import { useAppStore } from '../store/useAppStore'
import { Modal } from './Modal'
import { DEFAULT_BROKER_URL } from '../mqtt/client'

export function ConnectionSettings({ onClose }: { onClose: () => void }) {
  const connectionConfig = useAppStore((s) => s.connectionConfig)
  const setConnectionConfig = useAppStore((s) => s.setConnectionConfig)
  const connect = useAppStore((s) => s.connect)
  const disconnect = useAppStore((s) => s.disconnect)
  const connectionStatus = useAppStore((s) => s.connectionStatus)

  const [organizationId, setOrganizationId] = useState(connectionConfig?.organizationId ?? '')
  const [accessApiKey, setAccessApiKey] = useState(connectionConfig?.accessApiKey ?? '')
  const [brokerUrl, setBrokerUrl] = useState(connectionConfig?.brokerUrl ?? '')
  const [showAdvanced, setShowAdvanced] = useState(Boolean(connectionConfig?.brokerUrl))
  const [showKey, setShowKey] = useState(false)

  const canSave = organizationId.trim().length > 0 && accessApiKey.trim().length > 0

  function handleSaveAndConnect() {
    setConnectionConfig({
      organizationId: organizationId.trim(),
      accessApiKey: accessApiKey.trim(),
      brokerUrl: brokerUrl.trim() || undefined,
    })
    // connect() lê o estado atualizado do store na próxima tick; garantimos
    // a ordem chamando-o depois do set síncrono do zustand.
    setTimeout(() => connect(), 0)
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

        <button
          type="button"
          className="text-xs text-sky-400 hover:underline"
          onClick={() => setShowAdvanced((v) => !v)}
        >
          {showAdvanced ? 'Ocultar opções avançadas' : 'Opções avançadas'}
        </button>

        {showAdvanced && (
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

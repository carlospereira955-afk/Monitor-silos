import { useEffect, useState } from 'react'
import { useAppStore } from './store/useAppStore'
import { Header } from './components/Header'
import { SiloGrid } from './components/SiloGrid'

function useBrowserOnline() {
  const [online, setOnline] = useState(navigator.onLine)
  useEffect(() => {
    const handleOnline = () => setOnline(true)
    const handleOffline = () => setOnline(false)
    window.addEventListener('online', handleOnline)
    window.addEventListener('offline', handleOffline)
    return () => {
      window.removeEventListener('online', handleOnline)
      window.removeEventListener('offline', handleOffline)
    }
  }, [])
  return online
}

function App() {
  const initMqttListeners = useAppStore((s) => s.initMqttListeners)
  const initHttpPolling = useAppStore((s) => s.initHttpPolling)
  const startHttpPolling = useAppStore((s) => s.startHttpPolling)
  const connectionConfig = useAppStore((s) => s.connectionConfig)
  const httpPollingEnabled = useAppStore((s) => s.httpPollingEnabled)
  const browserOnline = useBrowserOnline()

  useEffect(() => {
    // O MQTT só é usado, sob pedido, pelo modo de deteção de sensor — não
    // liga automaticamente ao iniciar a app (deixou de ser preciso manter
    // uma ligação persistente só para o dashboard mostrar dados).
    initMqttListeners()
    initHttpPolling()
    // A atualização automática do dashboard usa pedidos HTTP periódicos.
    // Se já houver credenciais guardadas de uma sessão anterior e o
    // utilizador não a tiver pausado explicitamente, arranca logo — os
    // últimos valores conhecidos já estão disponíveis a partir do
    // armazenamento local, mesmo antes do primeiro pedido responder.
    if (connectionConfig?.organizationId && connectionConfig?.accessApiKey && httpPollingEnabled) {
      startHttpPolling()
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  return (
    <div className="min-h-screen bg-slate-950">
      <Header />

      {!browserOnline && (
        <div className="bg-amber-950/60 px-4 py-2 text-center text-xs text-amber-300">
          Sem ligação à internet neste dispositivo — a mostrar os últimos valores conhecidos.
        </div>
      )}

      <main className="mx-auto max-w-7xl px-4 py-6">
        <SiloGrid />
      </main>

      <footer className="mx-auto max-w-7xl px-4 pb-8 pt-4 text-center text-xs text-slate-600">
        Os dados e as últimas leituras ficam guardados neste dispositivo e continuam visíveis sem
        ligação à internet.
      </footer>
    </div>
  )
}

export default App

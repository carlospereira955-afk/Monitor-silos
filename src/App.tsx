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
  const connect = useAppStore((s) => s.connect)
  const connectionConfig = useAppStore((s) => s.connectionConfig)
  const browserOnline = useBrowserOnline()

  useEffect(() => {
    initMqttListeners()
    // Se já houver credenciais guardadas de uma sessão anterior, liga
    // automaticamente ao iniciar a app — os últimos valores conhecidos já
    // estão disponíveis a partir do armazenamento local, mesmo antes de a
    // ligação ser (re)estabelecida.
    if (connectionConfig?.organizationId && connectionConfig?.accessApiKey) {
      connect()
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

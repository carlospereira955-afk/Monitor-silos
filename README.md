# Monitor de Silos

Aplicação web para monitorização do nível de ração em silos, usando sensores
**SenseCAP S2100** (radar de distância) ligados via **LoRaWAN** a um gateway
**SenseCAP M2**, com os dados disponibilizados pela plataforma **SenseCraft**
por **MQTT sobre WebSocket**.

## Funcionalidades

- **Ligação MQTT/WebSocket configurável** à SenseCraft (`Organization ID` +
  `Access API Key`), guardada apenas neste dispositivo.
- **Múltiplos silos**, cada um com nome, altura, diâmetro, densidade da
  ração, offset de calibração e sensor associado (Device EUI, canal e
  measurement ID) configuráveis.
- **Modo de deteção de sensor**: como o measurement ID do sensor de
  distância varia por dispositivo, a app permite subscrever todas as
  medições de um Device EUI e ver ao vivo os IDs e valores recebidos, até
  identificar o correto.
- **Leitura automática via MQTT** ou **leitura manual** como alternativa,
  por silo.
- **Cálculo automático** por silo:
  - altura de ração = altura do silo − (leitura do radar + offset de
    calibração)
  - volume = área do círculo (a partir do diâmetro) × altura de ração
  - quantidade estimada (kg) = volume × densidade
- **Visualização gráfica** do nível de enchimento por silo (percentagem,
  quantidade em kg/toneladas, indicador de estado: baixo/médio/cheio).
- **Calibração por silo**: o utilizador introduz uma quantidade conhecida
  (kg) já presente no silo, e a app recalcula o offset de calibração para
  que a leitura atual do sensor passe a corresponder a essa quantidade.
- **Persistência local** (localStorage) de toda a configuração e das
  últimas leituras conhecidas — a app reabre sempre com os últimos dados
  disponíveis.
- **Resiliência offline**: se a ligação à internet cair, a app continua a
  mostrar os últimos valores conhecidos (assinalados como desatualizados
  ao fim de 30 minutos) e tenta reconectar-se automaticamente ao MQTT
  quando a rede volta, sem intervenção do utilizador. A app é instalável
  como PWA (funciona offline como aplicação, ainda que sem dados novos
  enquanto não houver rede).

## Como correr localmente

Requisitos: Node.js 18+.

```bash
npm install
npm run dev
```

Abre em `http://localhost:5173`.

Para produção:

```bash
npm run build
npm run preview
```

## Configurar a ligação

1. Em SenseCraft, ir a **Security → Access API Keys** e criar uma chave.
2. Na app, clicar em **Ligação** (canto superior direito) e introduzir o
   `Organization ID` e a `Access API Key`.
3. Guardar — a app liga-se automaticamente a
   `wss://sensecap-openstream.seeed.cc:8083/mqtt` (configurável em opções
   avançadas, caso seja necessário um endpoint diferente).

## Associar um sensor a um silo

1. Adicionar um silo e definir as suas dimensões e densidade da ração.
2. Em **Configurar**, introduzir o `Device EUI` do sensor.
3. Clicar em **Detetar measurement ID →** (ou usar o botão **Detetar
   sensor** no cabeçalho) para abrir o modo de deteção: a app subscreve
   todas as medições desse dispositivo e mostra os IDs e valores recebidos
   em tempo real.
4. Aproximar/afastar um objeto do sensor e identificar qual measurement ID
   varia de forma coerente com a distância — esse é o sensor de
   distância/radar. Clicar em **Usar neste silo** para aplicar
   automaticamente o canal e measurement ID corretos.

## Calibração

No cartão de cada silo, o botão **Calibrar** permite introduzir a
quantidade de ração (kg) que se sabe estar atualmente no silo (por
pesagem, guia de entrega, etc.). A app recalcula o offset de calibração
para que a leitura atual do sensor passe a corresponder a essa
quantidade — corrigindo assim, por exemplo, o formato ou ângulo de
enchimento do silo, que faz com que a leitura de distância não corresponda
exatamente à altura teórica de ração.

## Arquitetura

- **React + TypeScript + Vite**, com Tailwind CSS para a interface.
- **`mqtt` (MQTT.js)** para a ligação WebSocket ao broker da SenseCraft,
  com reconexão automática (`src/mqtt/client.ts`).
- **`src/mqtt/topics.ts`**: construção e parsing dos tópicos
  `/device_sensor_data/<OrgID>/<DeviceEUI>/<Channel>/+/<MeasurementID>` e do
  corpo `{"value": "...", "timestamp": "..."}`.
- **`zustand`** com middleware `persist` para estado global e persistência
  em `localStorage` (`src/store/useAppStore.ts`) — inclui configuração de
  ligação, lista de silos e última leitura de cada um.
- **`src/lib/calculations.ts`**: toda a lógica de cálculo de altura,
  volume, massa, percentagem, estado de enchimento e calibração — isolada
  e testável independentemente da UI.
- **`src/components/`**: componentes de UI (cabeçalho, grelha de silos,
  cartão de silo com indicador gráfico, modais de configuração, leitura
  manual, calibração e deteção de sensor).
- **PWA** (`vite-plugin-pwa`) para permitir instalar a app e mantê-la
  disponível offline como aplicação, mesmo sem dados novos em tempo real.

## Notas de segurança

A `Access API Key` é guardada apenas em `localStorage`, no próprio
dispositivo — nunca é enviada para nenhum servidor além do broker MQTT da
SenseCraft, usado exatamente como documentado pelo fabricante.

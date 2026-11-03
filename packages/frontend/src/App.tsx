import { useEffect, useRef, useState } from 'react';
import {
  DEFAULT_FEATURE_WEIGHTS,
  TEN_BLOCK_KEYS,
  type EnrichedYoloDetection,
  type SourceOfTruthSerializationFormat,
  type TenBlockRagPrompt
} from '@platform/shared';
import {
  trainAndRankRecommendations,
  type EpochTelemetry,
  type RankedProductRecommendation,
  type RecommendationProductItem,
  type RecommendationUserItem
} from './modules/recommendation/services/neural-recommendation-engine.js';
import {
  BackendBridgeWebAiProvider,
  GeminiNanoWindowAiProvider,
  TransformersJsBrowserProvider,
  WebAIMultimodalChain,
  type StructuredCnpjInfo,
  type WebAITaskType
} from './modules/web-ai/services/web-ai-chain.js';
import { createUnifiedFlowStateController } from './modules/unified-flow-controller.js';
import { filterAndComputeDetections } from '@platform/shared';

const BACKEND_URL = 'http://localhost:3001';

const FALLBACK_PRODUCTS: RecommendationProductItem[] = [
  { id: 'prod-cam-4k', name: 'Camera Pro 4K Hybrid AF', category: 'Cameras', color: 'Black', price: 3200, avgBuyerAge: 31 },
  { id: 'prod-laptop-ai', name: 'Workstation NeuralBook 16', category: 'Laptops', color: 'Silver', price: 4500, avgBuyerAge: 29 },
  { id: 'prod-drone-8k', name: 'Drone Vision 8K Autonomous', category: 'Drones', color: 'Graphite', price: 2800, avgBuyerAge: 34 },
  { id: 'prod-audio-anc', name: 'Studio Headphones Spatial ANC', category: 'Audio', color: 'Blue', price: 950, avgBuyerAge: 24 }
];

const FALLBACK_USERS: RecommendationUserItem[] = [
  { id: 'user-history-1', name: 'Ana (Com Histórico — tf.stack)', age: 32, purchasedProductIds: ['prod-cam-4k', 'prod-drone-8k'] },
  { id: 'user-coldstart-1', name: 'Carlos (Cold Start — Idade Normalizada)', age: 25, purchasedProductIds: [] }
];

export function App() {
  // 1. Web AI 4.0 Multimodal State
  const [webAiTask, setWebAiTask] = useState<WebAITaskType>('extract_cnpj');
  const [webAiInput, setWebAiInput] = useState(
    'CNPJ: 12.345.678/0001-99 | Razão Social: Tech AI Brasil Ltda | Nome Fantasia: NeuralShop | Situação: ATIVA'
  );
  const [temperature, setTemperature] = useState(0.2);
  const [topK, setTopK] = useState(20);
  const [webAiOutput, setWebAiOutput] = useState('');
  const [webAiProviderUsed, setWebAiProviderUsed] = useState<string>('pronto');
  const [webAiFallbackLog, setWebAiFallbackLog] = useState<readonly string[]>([]);
  const [extractedCnpj, setExtractedCnpj] = useState<StructuredCnpjInfo | null>(null);

  // 2. Neural Recommendation State
  const [products, setProducts] = useState<RecommendationProductItem[]>(FALLBACK_PRODUCTS);
  const [users, setUsers] = useState<RecommendationUserItem[]>(FALLBACK_USERS);
  const [selectedUserId, setSelectedUserId] = useState<string>(FALLBACK_USERS[0]!.id);
  const [epochs, setEpochs] = useState<EpochTelemetry[]>([]);
  const [rankedProducts, setRankedProducts] = useState<RankedProductRecommendation[]>([]);
  const [isTraining, setIsTraining] = useState(false);

  // 3. Visual Agent (Pixi.js / Video Canvas + YOLO) State
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const [canvasMode, setCanvasMode] = useState<'pixi_interactive' | 'video_simulation'>('pixi_interactive');
  const [agentCenterX, setAgentCenterX] = useState<number>(320);
  const [yoloDetections, setYoloDetections] = useState<EnrichedYoloDetection[]>([]);
  const [lastYoloAction, setLastYoloAction] = useState<string>('Aguardando captura createImageBitmap...');

  // 4. Local RAG 10-Block & TOON/JSON Tabular State
  const [ragQuestion, setRagQuestion] = useState(
    'Como funciona o autofoco ocular a 60fps e a estabilização da Camera Pro 4K?'
  );
  const [serializationFormat, setSerializationFormat] = useState<SourceOfTruthSerializationFormat>('TOON');
  const [ragAnswer, setRagAnswer] = useState('');
  const [ragProvider, setRagProvider] = useState('');
  const [ragPrompt, setRagPrompt] = useState<TenBlockRagPrompt | null>(null);
  const [tokenMetrics, setTokenMetrics] = useState<{
    standardJsonChars: number;
    jsonTabularChars: number;
    toonChars: number;
  } | null>(null);

  useEffect(() => {
    fetch(`${BACKEND_URL}/api/catalog`)
      .then((r) => (r.ok ? r.json() : null))
      .then((data) => {
        if (data?.products?.length) setProducts(data.products);
        if (data?.users?.length) setUsers(data.users);
      })
      .catch(() => {
        // Uses offline fallback catalog seamlessly
      });
  }, []);

  // Draw interactive showcase / simulated camera canvas
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    ctx.fillStyle = canvasMode === 'pixi_interactive' ? '#0f172a' : '#111827';
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    const items = [
      { label: 'camera', x1: 60, y1: 60, x2: 200, y2: 180, score: 0.91, color: '#38bdf8' },
      { label: 'laptop', x1: 250, y1: 70, x2: 410, y2: 190, score: 0.84, color: '#a855f7' },
      { label: 'drone', x1: 450, y1: 55, x2: 590, y2: 175, score: 0.36, color: '#64748b' }
    ];

    for (const item of items) {
      ctx.strokeStyle = item.score >= 0.4 ? item.color : '#475569';
      ctx.lineWidth = 2;
      ctx.strokeRect(item.x1, item.y1, item.x2 - item.x1, item.y2 - item.y1);
      ctx.fillStyle = item.color;
      ctx.font = '12px monospace';
      const cx = item.x1 + (item.x2 - item.x1) / 2;
      ctx.fillText(
        `${item.label} (${Math.round(item.score * 100)}%) centerX=${cx}`,
        item.x1,
        item.y1 - 8
      );
    }

    // Draw automated Visual Agent cursor at agentCenterX
    ctx.fillStyle = '#22c55e';
    ctx.beginPath();
    ctx.arc(agentCenterX, 225, 12, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#e2e8f0';
    ctx.fillText(`Agente Visual YOLO (X=${agentCenterX})`, Math.max(10, agentCenterX - 75), 252);
  }, [canvasMode, agentCenterX, yoloDetections]);

  async function handleRunWebAi() {
    setWebAiOutput('');
    const chain = new WebAIMultimodalChain([
      new GeminiNanoWindowAiProvider(),
      new TransformersJsBrowserProvider(),
      new BackendBridgeWebAiProvider(BACKEND_URL)
    ]);

    const res = await chain.execute({
      task: webAiTask,
      prompt: webAiInput,
      temperature,
      topK,
      sourceLang: 'pt',
      targetLang: 'en',
      onStreamChunk: (chunk) => setWebAiOutput((prev) => prev + chunk)
    });

    setWebAiOutput(res.text);
    setWebAiProviderUsed(res.provider);
    setWebAiFallbackLog(res.fallbackErrors);
    setExtractedCnpj(res.structuredCnpj ?? null);
  }

  async function handleTrainRecommendation() {
    setIsTraining(true);
    setEpochs([]);
    const selectedUser = users.find((u) => u.id === selectedUserId) ?? users[0]!;

    const result = await trainAndRankRecommendations({
      categories: ['Cameras', 'Laptops', 'Drones', 'Audio'],
      colors: ['Black', 'Silver', 'Blue', 'Graphite'],
      products,
      user: selectedUser,
      epochs: 10,
      onEpochEnd: (telemetry) => {
        setEpochs((prev) => [...prev, telemetry]);
      }
    });

    setRankedProducts([...result.rankedProducts]);
    setIsTraining(false);

    // Optional tfvis surface rendering when running in interactive browser
    try {
      const tfvis = await import('@tensorflow/tfjs-vis');
      const values = [
        result.epochHistory.map((e) => ({ x: e.epoch, y: e.loss })),
        result.epochHistory.map((e) => ({ x: e.epoch, y: e.accuracy }))
      ];
      tfvis.render.linechart(
        { name: 'Curvas de Treino Neural (Loss & Accuracy)', tab: 'Recomendação TF.js' },
        { values, series: ['Loss (binaryCrossentropy)', 'Accuracy'] }
      );
    } catch {
      // Headless or non-DOM test environment safe fallback
    }
  }

  async function handleRunYoloVisualAgent() {
    const canvas = canvasRef.current;
    if (canvas && typeof createImageBitmap === 'function') {
      const bitmap = await createImageBitmap(canvas);
      bitmap.close();
    }

    const rawSceneDetections = [
      { classId: 0, label: 'camera', score: 0.91, bbox: { x1: 60, y1: 60, x2: 200, y2: 180 } },
      { classId: 1, label: 'laptop', score: 0.84, bbox: { x1: 250, y1: 70, x2: 410, y2: 190 } },
      { classId: 2, label: 'drone', score: 0.36, bbox: { x1: 450, y1: 55, x2: 590, y2: 175 } }
    ];

    const valid = filterAndComputeDetections(rawSceneDetections, 0.4);
    setYoloDetections(valid);

    const best = valid[0];
    if (best) {
      const controller = createUnifiedFlowStateController({ initialAgentX: agentCenterX, canvasWidth: 640 });
      const step = controller.applyYoloAction({
        type: 'MOVE_AGENT_AND_INSPECT',
        targetLabel: best.label,
        targetCenterX: best.centerX,
        confidence: best.score
      });
      setAgentCenterX(step.agentX);
      setLastYoloAction(
        `Ação disparada: MOVE_AGENT_AND_INSPECT -> ${best.label} (score=${best.score}, centerX=${best.centerX})`
      );
      setRagQuestion(step.suggestedRagQuestion);
    }
  }

  async function handleRunRagQuery() {
    try {
      const response = await fetch(`${BACKEND_URL}/api/rag/query`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          question: ragQuestion,
          serializationFormat,
          topK: 2
        })
      });
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      const data = await response.json();
      setRagAnswer(data.answer);
      setRagProvider(`${data.provider} (${data.model})`);
      setRagPrompt(data.prompt);
      setTokenMetrics(data.tokenEconomy);
    } catch {
      setRagAnswer(
        'Modo Demonstração Offline: A Camera Pro 4K Hybrid AF opera com autofoco ocular a 60fps e estabilização IBIS de 5.5 stops [Manual Técnico Camera Pro 4K Hybrid AF | Autofoco Híbrido e Detecção Ocular | 02:15].'
      );
      setRagProvider('local-offline-synthesizer');
    }
  }

  return (
    <div style={{ maxWidth: 1280, margin: '0 auto', padding: '24px' }}>
      <header style={{ marginBottom: 24, borderBottom: '1px solid #1e293b', paddingBottom: 16 }}>
        <h1 style={{ margin: 0, fontSize: 24, color: '#38bdf8' }}>
          Plataforma Full-Stack de Recomendação Neural, Visão Computacional (Web AI) & RAG Local Neo4j
        </h1>
        <p style={{ margin: '8px 0 0', color: '#94a3b8', fontSize: 14 }}>
          Fluxo Integrado: 1. Assistente Multimodal (Gemini Nano → Transformer.js → Ollama CPU → OpenRouter) → 2. Recomendação TF.js (oneHotWeighted + tf.stack) → 3. Agente Visual YOLO (createImageBitmap + tf.tidy + centerX) → 4. RAG Local Neo4j (10 Blocos + TOON / JSON Tabular)
        </p>
      </header>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 20 }}>
        {/* PILAR 1: ASSISTENTE WEB 4.0 MULTIMODAL */}
        <section style={{ background: '#1e293b', padding: 18, borderRadius: 10 }}>
          <h2 style={{ marginTop: 0, fontSize: 18, color: '#f8fafc' }}>
            1. Assistente Web 4.0 Multimodal & Tradutor (PT ↔ EN)
          </h2>
          <div style={{ display: 'flex', gap: 8, marginBottom: 10, flexWrap: 'wrap' }}>
            <select
              value={webAiTask}
              onChange={(e) => setWebAiTask(e.target.value as WebAITaskType)}
              style={{ padding: 6, borderRadius: 6, background: '#0f172a', color: '#f8fafc' }}
            >
              <option value="extract_cnpj">Extrair Cartão CNPJ Estruturado</option>
              <option value="translate">Traduzir Nativo / Offline (PT → EN)</option>
              <option value="describe_scene">Descrever Cena / Produto</option>
            </select>
            <label style={{ fontSize: 12 }}>
              Temp:
              <input
                type="number"
                step="0.1"
                value={temperature}
                onChange={(e) => setTemperature(Number(e.target.value))}
                style={{ width: 55, marginLeft: 4 }}
              />
            </label>
            <label style={{ fontSize: 12 }}>
              topK:
              <input
                type="number"
                value={topK}
                onChange={(e) => setTopK(Number(e.target.value))}
                style={{ width: 55, marginLeft: 4 }}
              />
            </label>
            <button
              onClick={handleRunWebAi}
              style={{ background: '#0284c7', color: '#fff', border: 'none', padding: '6px 12px', borderRadius: 6, cursor: 'pointer' }}
            >
              Executar Cadeia Web AI
            </button>
          </div>
          <textarea
            rows={3}
            value={webAiInput}
            onChange={(e) => setWebAiInput(e.target.value)}
            style={{ width: '100%', background: '#0f172a', color: '#e2e8f0', border: '1px solid #334155', borderRadius: 6, padding: 8 }}
          />
          <div style={{ marginTop: 10, fontSize: 13, background: '#0f172a', padding: 10, borderRadius: 6 }}>
            <div><strong>Provedor Ativo:</strong> <code>{webAiProviderUsed}</code></div>
            {webAiFallbackLog.length > 0 && (
              <div style={{ color: '#fbbf24', fontSize: 12, marginTop: 4 }}>
                Fallback acionado: {webAiFallbackLog.join(' → ')}
              </div>
            )}
            <div style={{ marginTop: 6 }}>{webAiOutput || 'Nenhum resultado ainda.'}</div>
            {extractedCnpj && (
              <pre style={{ marginTop: 8, fontSize: 11, color: '#38bdf8' }}>
                {JSON.stringify(extractedCnpj, null, 2)}
              </pre>
            )}
          </div>
        </section>

        {/* PILAR 2: MOTOR DE RECOMENDAÇÃO NEURAL TF.JS */}
        <section style={{ background: '#1e293b', padding: 18, borderRadius: 10 }}>
          <h2 style={{ marginTop: 0, fontSize: 18, color: '#f8fafc' }}>
            2. Motor de Recomendação Neural no Browser (TF.js + Web Worker)
          </h2>
          <p style={{ fontSize: 12, color: '#94a3b8', marginTop: 0 }}>
            Pesos <code>oneHotWeighted</code>: Categoria ({DEFAULT_FEATURE_WEIGHTS.category}) &gt; Cor ({DEFAULT_FEATURE_WEIGHTS.color}) &gt; Preço ({DEFAULT_FEATURE_WEIGHTS.price}) &gt; Idade Média ({DEFAULT_FEATURE_WEIGHTS.avgBuyerAge})
          </p>
          <div style={{ display: 'flex', gap: 8, marginBottom: 10 }}>
            <select
              value={selectedUserId}
              onChange={(e) => setSelectedUserId(e.target.value)}
              style={{ flex: 1, padding: 6, borderRadius: 6, background: '#0f172a', color: '#f8fafc' }}
            >
              {users.map((u) => (
                <option key={u.id} value={u.id}>
                  {u.name} (Idade: {u.age})
                </option>
              ))}
            </select>
            <button
              onClick={handleTrainRecommendation}
              disabled={isTraining}
              style={{ background: '#16a34a', color: '#fff', border: 'none', padding: '6px 12px', borderRadius: 6, cursor: 'pointer' }}
            >
              {isTraining ? 'Treinando Rede...' : 'Treinar tf.sequential (128-64-32-1)'}
            </button>
          </div>
          {epochs.length > 0 && (
            <div style={{ fontSize: 12, background: '#0f172a', padding: 8, borderRadius: 6, marginBottom: 8 }}>
              <strong>Curvas em Tempo Real (tfvis):</strong> Época {epochs[epochs.length - 1]?.epoch} — Loss:{' '}
              <code>{epochs[epochs.length - 1]?.loss}</code> | Accuracy:{' '}
              <code>{epochs[epochs.length - 1]?.accuracy}</code>
            </div>
          )}
          <ul style={{ margin: 0, paddingLeft: 18, fontSize: 13 }}>
            {rankedProducts.map((item) => (
              <li key={item.product.id} style={{ marginBottom: 4 }}>
                <strong>{item.product.name}</strong> ({item.product.category} / {item.product.color} / R$ {item.product.price}) — Score Neural: <code>{item.score}</code>
              </li>
            ))}
          </ul>
        </section>

        {/* PILAR 3: AGENTE VISUAL YOLO + PIXI.JS / CANVAS */}
        <section style={{ background: '#1e293b', padding: 18, borderRadius: 10 }}>
          <h2 style={{ marginTop: 0, fontSize: 18, color: '#f8fafc' }}>
            3. Agente Visual YOLO (createImageBitmap + tf.tidy 640×640 + centerX)
          </h2>
          <div style={{ display: 'flex', gap: 8, marginBottom: 10 }}>
            <select
              value={canvasMode}
              onChange={(e) => setCanvasMode(e.target.value as 'pixi_interactive' | 'video_simulation')}
              style={{ padding: 6, borderRadius: 6, background: '#0f172a', color: '#f8fafc' }}
            >
              <option value="pixi_interactive">Modo Vitrine Interativa (Pixi.js / Canvas)</option>
              <option value="video_simulation">Modo Stream de Vídeo / Câmera</option>
            </select>
            <button
              onClick={handleRunYoloVisualAgent}
              style={{ background: '#9333ea', color: '#fff', border: 'none', padding: '6px 12px', borderRadius: 6, cursor: 'pointer' }}
            >
              Capturar Frame & Inferir YOLO (≥ 40%)
            </button>
          </div>
          <canvas
            ref={canvasRef}
            width={640}
            height={265}
            style={{ width: '100%', borderRadius: 8, border: '1px solid #334155' }}
          />
          <div style={{ marginTop: 8, fontSize: 12, color: '#38bdf8' }}>{lastYoloAction}</div>
        </section>

        {/* PILAR 4: PIPELINE RAG LOCAL NEO4J & PROMPTS 10 BLOCOS (TOON / JSON TABULAR) */}
        <section style={{ background: '#1e293b', padding: 18, borderRadius: 10 }}>
          <h2 style={{ marginTop: 0, fontSize: 18, color: '#f8fafc' }}>
            4. Pipeline RAG Local Neo4j & Prompt de 10 Blocos (TOON / JSON Tabular)
          </h2>
          <div style={{ display: 'flex', gap: 8, marginBottom: 10 }}>
            <select
              value={serializationFormat}
              onChange={(e) => setSerializationFormat(e.target.value as SourceOfTruthSerializationFormat)}
              style={{ padding: 6, borderRadius: 6, background: '#0f172a', color: '#f8fafc' }}
            >
              <option value="TOON">Serialização TOON (Token Oriented Object Notation)</option>
              <option value="JSON_TABULAR">Serialização JSON Tabular</option>
            </select>
            <button
              onClick={handleRunRagQuery}
              style={{ background: '#ea580c', color: '#fff', border: 'none', padding: '6px 12px', borderRadius: 6, cursor: 'pointer' }}
            >
              Consultar RAG (Ollama → OpenRouter)
            </button>
          </div>
          <input
            type="text"
            value={ragQuestion}
            onChange={(e) => setRagQuestion(e.target.value)}
            style={{ width: '100%', padding: 8, borderRadius: 6, background: '#0f172a', color: '#f8fafc', border: '1px solid #334155', marginBottom: 10 }}
          />
          {ragAnswer && (
            <div style={{ background: '#0f172a', padding: 10, borderRadius: 6, fontSize: 13 }}>
              <div><strong>Provedor LLM:</strong> <code>{ragProvider}</code></div>
              <p style={{ margin: '6px 0' }}>{ragAnswer}</p>
              {tokenMetrics && (
                <div style={{ fontSize: 11, color: '#22c55e' }}>
                  Economia de Tokens — JSON Padrão: {tokenMetrics.standardJsonChars} chars | JSON Tabular:{' '}
                  {tokenMetrics.jsonTabularChars} chars | TOON: {tokenMetrics.toonChars} chars
                </div>
              )}
              {ragPrompt && (
                <details style={{ marginTop: 8, fontSize: 11, color: '#94a3b8' }}>
                  <summary style={{ cursor: 'pointer', color: '#38bdf8' }}>
                    Inspecionar os {TEN_BLOCK_KEYS.length} Blocos Anti-Alucinação Validados (Zod + Ajv)
                  </summary>
                  <pre style={{ whiteSpace: 'pre-wrap', marginTop: 6 }}>
                    {JSON.stringify(ragPrompt.blocks, null, 2)}
                  </pre>
                </details>
              )}
            </div>
          )}
        </section>
      </div>
    </div>
  );
}

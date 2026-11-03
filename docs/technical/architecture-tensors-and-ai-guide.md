# Guia Técnico Ilustrado — Arquitetura, Fluxo de Tensores, TensorFlow.js e Busca por Cosseno

> Documento de referência didática e técnica sobre os conceitos fundamentais de Inteligência Artificial, estruturas de tensores e fluxos arquiteturais implementados na plataforma.

---

## 1. Busca por Similaridade de Cosseno (*Cosine Similarity Search*)

### 1.1. O Conceito Intuitivo
Uma **busca por similaridade de cosseno** é uma técnica matemática usada para medir quão parecidos são dois vetores (*embeddings* de texto ou vetores de perfil/produto) calculando o **cosseno do ângulo** entre eles num espaço multidimensional, em vez de medir a distância física direta entre as suas pontas.

- Quando transformamos textos em vetores (*embeddings*), cada frase vira uma "seta" apontando para uma direção semântica no espaço.
- Se dois textos falam sobre o mesmo assunto (ex.: *"Como configurar o foco contínuo da câmera"* e *"Ajuste de autofoco em 60fps no manual"*), as suas setas apontam praticamente para a **mesma direção** ($\theta \approx 0^\circ$).
- Medir apenas o ângulo garante que o tamanho do texto não distorça a comparação: importa **para onde as setas apontam** (o significado).

### 1.2. Fórmula Matemática
Dados dois vetores $A$ (ex.: a pergunta do utilizador) e $B$ (ex.: um *chunk* salvo no Neo4j), a similaridade de cosseno é calculada pelo produto escalar dividido pelo produto das suas magnitudes (normas euclidianas):

$$\text{similarity}(A, B) = \cos(\theta) = \frac{A \cdot B}{\|A\| \|B\|} = \frac{\sum_{i=1}^{n} A_i B_i}{\sqrt{\sum_{i=1}^{n} A_i^2} \sqrt{\sum_{i=1}^{n} B_i^2}}$$

- **`1.0` ($\theta = 0^\circ$):** Mesma direção exata (semanticamente idênticos).
- **`0.0` ($\theta = 90^\circ$):** Vetores ortogonais (assuntos sem relação).
- **`-1.0` ($\theta = 180^\circ$):** Direções opostas.

### 1.3. Onde a Busca por Cosseno é Usada no Projeto
1. **No Pipeline RAG Local com Neo4j (`packages/backend/src/modules/rag/`):**
   - O modelo `Xenova/all-MiniLM-L6-v2` gera vetores de `384` dimensões normalizados (`L2`).
   - O índice vetorial do Neo4j é configurado com `vector.similarity_function: 'cosine'`.
   - Na consulta `CALL db.index.vector.queryNodes(...)`, o Neo4j retorna os `topK` trechos com maior `score` de cosseno, juntamente com os metadados obrigatórios (`title`, `section`, `videoMinute`), que alimentam o bloco **3. Fonte da Verdade** do prompt de 10 blocos.
2. **Na Afinidade entre Perfil do Utilizador e Produto (`packages/frontend/src/modules/recommendation/`):**
   - A função `cosineAffinity(userProfileVector, productVector)` mede o alinhamento angular entre o vetor médio de compras do utilizador e cada item do catálogo para auxiliar a rotulagem supervisionada do treino em tempo real.

---

## 2. Diagrama Manual da Arquitetura Geral e Fluxo Ponta a Ponta

### 2.1. Diagrama Manual (ASCII) da Arquitetura Hexagonal em Monorepo

```text
+=========================================================================================+
|                            MONOREPO (@platform/*)                                       |
|                                                                                         |
|   +---------------------------------------------------------------------------------+   |
|   |                        @platform/shared (Núcleo Puro)                           |   |
|   |  - Domínio Matemático: normalizeMinMax, oneHotWeighted, calculateCenterX        |   |
|   |  - Prompt Builder: Montador dos 10 Blocos Anti-Alucinação                       |   |
|   |  - Serializadores: JSON Tabular & TOON (Token Oriented Object Notation)         |   |
|   |  - Contratos & Schemas: Validação Zod / Ajv (DTOs, CNPJ, Mensagens de Worker)   |   |
|   +----------------------------------------+----------------------------------------+   |
|                                            | (Importado por Frontend e Backend)         |
+============================================|============================================+
                                             v
+-----------------------------------------------------------------------------------------+
| NAVEGADOR (Client-Side — @platform/frontend)                                            |
|                                                                                         |
|  [ UI Principal: React 19 + Vite ] (Main Thread - Non-Blocking)                         |
|    |-- Módulo 1: Assistente Web 4.0 (CNPJ / Cena / Áudio / Tradução PT<->EN)            |
|    |-- Módulo 2: Painel de Recomendação + Gráficos em Tempo Real (tfvis)                |
|    |-- Módulo 3: Vitrine Interativa 2D (Pixi.js / <canvas> / Vídeo)                     |
|    +-- Módulo 4: Chat RAG Inteligente (Streaming / Citações / Seletor TOON vs JSON)     |
|          |                         |                              |                     |
|          | postMessage             | Transferable (ImageBitmap)   | postMessage         |
|          v                         v                              v                     |
|  +--------------------+   +-----------------------+   +-----------------------------+   |
|  | recommendation     |   | yolo.worker.ts        |   | webai-transformers.worker   |   |
|  | .worker.ts         |   | - tf.tidy([640, 640]) |   | - Fallback in-browser       |   |
|  | - tf.stack perfil  |   | - YOLOv8n executeAsync|   |   (@huggingface/            |   |
|  | - tf.sequential    |   | - threshold >= 0.40   |   |    transformers)            |   |
|  |   (128->64->32->1) |   | - calcula centerX     |   |   quando window.ai (Nano)   |   |
|  | - emite epochEnd   |   | - retorna ação p/ UI  |   |   não está disponível       |   |
|  +--------------------+   +-----------------------+   +-----------------------------+   |
+--------------------------------------------|--------------------------------------------+
                                             |
                                             | REST (JSON) / SSE (Streaming)
                                             v
+-----------------------------------------------------------------------------------------+
| SERVIDOR (Server-Side — @platform/backend — Fastify + Node.js 22)                       |
|                                                                                         |
|  +-----------------------+  +---------------------------+  +-------------------------+  |
|  | Catalog Module        |  | LLM Router Module         |  | RAG Local Module        |  |
|  | - Catálogo de Produtos|  | - Cadeia de Fallback:     |  | - Ingestão PDF/Vídeo    |  |
|  | - Histórico de Compras|  |   1. Ollama (Local)       |  | - Chunking Semântico    |  |
|  |                       |  |   2. OpenRouter (Cloud)   |  | - Embeddings 384 dims   |  |
|  |                       |  | - Telemetria e Retry      |  |   (all-MiniLM-L6-v2)    |  |
|  |                       |  |                           |  | - Prompt de 10 Blocos   |  |
|  +-----------------------+  +-------------+-------------+  +------------+------------+  |
+-------------------------------------------|-----------------------------|---------------+
                                            |                             |
                         +------------------+                             | Bolt Protocol
                         | HTTP                                           v
+------------------------v----------------------------------------------------------------+
| INFRAESTRUTURA LOCAL (Docker Compose) & CLOUD FALLBACK                                  |
|                                                                                         |
|  +----------------------------------------+   +--------------------------------------+  |
|  | Container: Ollama CPU (:11434)         |   | Container: Neo4j 5.26 (:7687)        |  |
|  | - Texto: qwen2.5:1.5b                  |   | - Nós (:Document)-[:HAS_CHUNK]->     |  |
|  | - Visão: moondream                     |   |   (:Chunk {title, section,           |  |
|  +-------------------+--------------------+   |            videoMinute, embedding})  |  |
|                      | Se falhar/timeout      | - Vector Index (Cosine Similarity)   |  |
|                      v                        +--------------------------------------+  |
|  +----------------------------------------+                                             |
|  | Cloud: OpenRouter API (Fallback Final) |                                             |
|  | - google/gemini-2.0-flash-exp:free     |                                             |
|  +----------------------------------------+                                             |
+-----------------------------------------------------------------------------------------+
```

### 2.2. Passo a Passo de um Fluxo Completo na Aplicação

1. **Etapa 1 — Triagem e Extração com Assistente Multimodal Web 4.0 (RN06):**
   - O utilizador ou lojista envia uma imagem de **Cartão CNPJ**, uma cena de produto ou um texto para tradução (`PT <-> EN`).
   - O módulo `web-ai` percorre a cadeia de resiliência:
     1. `Gemini Nano (window.ai)` nativo no navegador;
     2. `Transformer.js` em Web Worker no navegador (`webai-transformers.worker.ts`);
     3. `Ollama (Container CPU)` via Fastify (`moondream` para visão ou `qwen2.5:1.5b` para texto);
     4. `OpenRouter` em nuvem caso o container local falhe.
   - Os dados extraídos (`cnpj`, `razaoSocial`, `nomeFantasia`, `situacaoCadastral`) retornam validados por schema Zod.

2. **Etapa 2 — Recomendação Neural em Tempo Real no Browser (RN01 a RN04):**
   - A UI carrega o catálogo e o utilizador selecionado (com histórico de compras ou em *cold start* apenas com a idade) e delega o treino ao `recommendation.worker.ts`.
   - O Worker normaliza variáveis contínuas (`normalizeMinMax`), codifica variáveis categóricas com pesos (`oneHotWeighted`: categoria `0.40`, cor `0.25`, preço `0.20`, idade média `0.15`), calcula o perfil com `tf.stack` e treina a rede `tf.sequential` (`128 -> 64 -> 32 -> 1`).
   - A cada época (`onEpochEnd`), a UI recebe `loss` e `accuracy` para atualizar os gráficos do `tfvis`, exibindo o ranking final de recomendações.

3. **Etapa 3 — Vitrine Interativa Pixi.js e Agente Visual YOLO (RN05):**
   - Os produtos da vitrine são renderizados num `<canvas>` 2D com Pixi.js (ou câmera/vídeo).
   - A UI captura o frame com `createImageBitmap` e transfere-o para o `yolo.worker.ts`.
   - O Worker pré-processa o frame em `tf.tidy` (`[1, 640, 640, 3]`), executa `model.executeAsync()`, filtra detecções com `score >= 0.40`, calcula $\text{centerX} = x_1 + \frac{x_2 - x_1}{2}$ e comanda o agente visual para inspecionar o produto detectado.

4. **Etapa 4 — Consulta Técnica no Chat RAG Local com Neo4j (RN07 e RN08):**
   - O utilizador faz uma pergunta técnica sobre o item inspecionado.
   - O backend gera o embedding de `384` dimensões da pergunta (`Xenova/all-MiniLM-L6-v2`), faz a busca por similaridade de cosseno no Neo4j e recupera os chunks com `title`, `section` e `videoMinute`.
   - O motor monta o **Prompt de 10 Blocos Anti-Alucinação** serializando a **Fonte da Verdade** em **TOON** ou **JSON Tabular**, valida com Zod/Ajv e consulta o `LLM Router` (`Ollama -> OpenRouter`), retornando a resposta fundamentada com citações verificáveis.

---

## 3. Fluxo Detalhado dos Tensores na Plataforma

### 3.1. Pipeline de Tensores na Recomendação Neural

Considerando um catálogo com **3 categorias** e **3 cores**, cada vetor de produto ou perfil possui dimensão $D = 3 + 3 + 1 + 1 = 8$:

```text
=========================================================================================
ETAPA A: Codificação de Cada Produto em Vetor 1D (Dimensão D = 8)
=========================================================================================
Produto Bruto: { categoria: idx 0, cor: idx 2, preço: R$ 550, idadeMédia: 30 }

1. Categoria (oneHotWeighted, peso 0.40) ---> [ 0.40, 0.00, 0.00 ]  (3 posições)
2. Cor       (oneHotWeighted, peso 0.25) ---> [ 0.00, 0.00, 0.25 ]  (3 posições)
3. Preço     (normalizeMinMax * 0.20)    ---> [ 0.10 ]              (1 posição)
4. IdadeMéd  (normalizeMinMax * 0.15)    ---> [ 0.06 ]              (1 posição)
                                                |
                                                v Concatenação
Vetor do Produto (pVec): [ 0.40, 0.00, 0.00, 0.00, 0.00, 0.25, 0.10, 0.06 ]  --> Shape: [8]


=========================================================================================
ETAPA B: Cálculo do Tensor de Perfil do Utilizador (RN03 — dentro de tf.tidy)
=========================================================================================
CASO 1: Utilizador COM Histórico (ex.: comprou K = 2 produtos)
  pVec_1 (tf.tensor1d) -----> [ 0.40, 0.00, 0.00, 0.00, 0.25, 0.00, 0.12, 0.05 ]  Shape: [8]
  pVec_2 (tf.tensor1d) -----> [ 0.40, 0.00, 0.00, 0.00, 0.00, 0.25, 0.08, 0.07 ]  Shape: [8]
                                     |
                                     v tf.stack([pVec_1, pVec_2])
  Tensor 2D Empilhado ------> [ [ 0.40, ..., 0.05 ],
                                [ 0.40, ..., 0.07 ] ]                             Shape: [2, 8]
                                     |
                                     v tf.mean(stacked, 0)  (Média no eixo 0 / vertical)
  userProfileVector --------> [ 0.40, 0.00, 0.00, 0.00, 0.125, 0.125, 0.10, 0.06 ] Shape: [8]

CASO 2: Utilizador SEM Histórico (Cold Start, K = 0)
  Fallback (idade norm * 0.15) -> [ 0, 0, 0, 0, 0, 0, 0, 0.08 ]                   Shape: [8]


=========================================================================================
ETAPA C: Montagem dos Tensores de Treino (xs e ys) para N Produtos do Catálogo
=========================================================================================
Para cada produto i de 1 até N (ex.: N = 6 produtos):
  Entrada combinada = [ ...userProfileVector (8), ...pVec_i (8) ] --------------> Shape: [16]
  Rótulo (label y)  = Comprado OU cosineAffinity(user, prod) >= 0.65 ? 1 : 0 ---> Shape: [1]

  xs = tf.tensor2d(xRows)   ---> Matriz [N, 2*D] = Shape: [6, 16] (float32)
  ys = tf.tensor2d(yLabels) ---> Matriz [N, 1]   = Shape: [6, 1]  (float32: 0.0 ou 1.0)


=========================================================================================
ETAPA D: Forward & Backpropagation na Rede Neural (tf.sequential)
=========================================================================================
  xs: Tensor2D [6, 16]
         |
         v  Dense Layer 1 (units: 128, activation: 'relu')
  Tensor Oculto 1 [6, 128]
         |
         v  Dense Layer 2 (units: 64,  activation: 'relu')
  Tensor Oculto 2 [6, 64]
         |
         v  Dense Layer 3 (units: 32,  activation: 'relu')
  Tensor Oculto 3 [6, 32]
         |
         v  Output Layer  (units: 1,   activation: 'sigmoid')
  Predição (y_hat): Tensor2D [6, 1] (Valores contínuos entre 0.0 e 1.0 = probabilidade)
         |
         +--> model.fit(): Compara y_hat [6,1] com ys [6,1] via binaryCrossentropy
         |                 Ajusta pesos com Adam (lr = 0.01) e emite { loss, accuracy } -> tfvis
         |
         +--> model.predict(xs) dentro de tf.tidy() -> extrai scores -> xs.dispose(), ys.dispose()
```

### 3.2. Pipeline de Tensores no Agente Visual YOLOv8n

```text
+---------------------------------------------------------------------------------------+
| 1. CAPTURA NO CANVAS (Main Thread -> Web Worker)                                      |
|    <canvas> (ex.: 800x600 RGBA)                                                       |
|       |--> createImageBitmap(canvas)                                                  |
|       |--> postMessage({ bitmap }, [bitmap]) (Transferência Zero-Copy p/ Worker)      |
+-------------------------------------------+-------------------------------------------+
                                            |
                                            v
+---------------------------------------------------------------------------------------+
| 2. PRÉ-PROCESSAMENTO DENTRO DE tf.tidy() (Descarta tensores intermediários sozinho)   |
|                                                                                       |
|    tf.browser.fromPixels(bitmap)                                                      |
|       └──> Tensor3D [Altura, Largura, 3]  (ex.: [600, 800, 3], int32, valores 0..255) |
|                   |                                                                   |
|                   v .resizeBilinear([640, 640])                                       |
|       └──> Tensor3D [640, 640, 3]         (float32, interpolação bilinear)            |
|                   |                                                                   |
|                   v .div(255.0)                                                       |
|       └──> Tensor3D [640, 640, 3]         (float32, pixels normalizados em [0.0, 1.0])|
|                   |                                                                   |
|                   v .expandDims(0)        (Adiciona eixo de Batch na posição 0)       |
|       └──> inputTensor: Tensor4D [1, 640, 640, 3]  (Único tensor que sai do tf.tidy)  |
+-------------------------------------------+-------------------------------------------+
                                            |
                                            v
+---------------------------------------------------------------------------------------+
| 3. INFERÊNCIA ASSÍNCRONA (model.executeAsync(inputTensor))                            |
|                                                                                       |
|    Retorna Array de Tensores de Saída do Grafo YOLOv8n:                               |
|      - boxesTensor:   Tensor2D [M, 4]  --> Coordenadas [x1, y1, x2, y2] de M caixas   |
|      - scoresTensor:  Tensor1D [M]     --> Confiança de cada caixa (0.0 a 1.0)        |
|      - classesTensor: Tensor1D [M]     --> ID inteiro da classe detectada (0, 1, ...) |
+-------------------------------------------+-------------------------------------------+
                                            |
                                            v
+---------------------------------------------------------------------------------------+
| 4. EXTRAÇÃO, FILTRAGEM, GEOMETRIA E LIMPEZA DE MEMÓRIA                                |
|                                                                                       |
|    - Extrai dados para JS arrays (.dataSync())                                        |
|    - Descarta imediatamente: boxes.dispose(), scores.dispose(), classes.dispose(),    |
|                              inputTensor.dispose(), bitmap.close()                    |
|    - Filtra apenas caixas onde score >= 0.40 (40%)                                    |
|    - Calcula centro horizontal: centerX = x1 + (x2 - x1) / 2                          |
|    - Dispara comando: { type: 'MOVE_AGENT_AND_INSPECT', targetCenterX: centerX }      |
+---------------------------------------------------------------------------------------+
```

### 3.3. Tabela Comparativa de Todos os Tensores da Plataforma

| Módulo | Onde Roda | Formato (`Shape`) | Tipo (`dtype`) | Gerenciamento de Memória |
|---|---|---|---|---|
| **Vetor de Produto (`pVec`)** | Browser (`recommendation.worker`) | `[D]` (ex.: `[8]`) | `float32` | Criado e descartado dentro de `tf.tidy()` |
| **Pilha de Compras (`tf.stack`)** | Browser (`recommendation.worker`) | `[K, D]` (ex.: `[2, 8]`) | `float32` | Descartado automaticamente pelo `tf.tidy()` após `tf.mean(..., 0)` |
| **Matriz de Treino (`xs` / `ys`)** | Browser (`recommendation.worker`) | `xs: [N, 2D]`, `ys: [N, 1]` | `float32` | `xs.dispose()`, `ys.dispose()` e `model.dispose()` no bloco `finally` |
| **Frame de Entrada YOLO** | Browser (`yolo.worker`) | `[1, 640, 640, 3]` | `float32` (`0..1`) | `tf.tidy()` nos intermediários + `inputTensor.dispose()` + `bitmap.close()` |
| **Embedding de Texto RAG** | Backend Node.js (`Xenova/all-MiniLM-L6-v2`) | `[384]` (normalizado L2) | `float32` | Convertido em `number[]` e indexado no Neo4j Vector Index |

---

## 4. O que é o TensorFlow.js e Como Funciona na Prática

### 4.1. Definição
O **TensorFlow** é uma biblioteca de Machine Learning e Deep Learning criada pelo Google. O **TensorFlow.js (`@tensorflow/tfjs`)** traz esse motor para o navegador e para o Node.js, permitindo treinar e executar redes neurais diretamente no cliente com aceleração de hardware (WebGL / WebGPU / WASM).

- **Tensor:** Generalização de vetores e matrizes para qualquer número de dimensões:
  - `0D` (Escalar): `5`
  - `1D` (Vetor): `[0.40, 0.25, 0.10]`
  - `2D` (Matriz): `[[1, 2], [3, 4]]`
  - `3D` (Imagem `[H, W, RGB]`): `[640, 640, 3]`
  - `4D` (Batch de Imagens `[B, H, W, RGB]`): `[1, 640, 640, 3]`
- **Flow (Fluxo):** Os tensores fluem por uma sequência de operações matriciais e funções de ativação, permitindo tanto inferência (*forward pass*) quanto ajuste automático de pesos (*backpropagation*).

### 4.2. Por que Gerenciar Memória com `tf.tidy` e `.dispose()`?
Para multiplicar matrizes rapidamente, o TensorFlow.js aloca os tensores na memória da placa de vídeo (WebGL), onde o *Garbage Collector* padrão do JavaScript não alcança automaticamente.
- **`tf.tidy(() => ...)`:** Executa uma função síncrona e limpa automaticamente todos os tensores intermediários criados dentro dela, mantendo apenas o tensor retornado.
- **`tensor.dispose()`:** Libera manualmente um tensor específico quando ele não é mais necessário (por exemplo, após um `await model.fit(...)`).

### 4.3. O que Significam `relu`, `sigmoid`, `binaryCrossentropy` e `adam`?
1. **`relu` ($\max(0, x)$) nas camadas ocultas (`128 -> 64 -> 32`):**
   - Se o valor calculado pelo neurônio for negativo, ele vira `0`; se for positivo, continua igual. Isso permite que a rede aprenda combinações não-lineares de features rapidamente.
2. **`sigmoid` ($\sigma(z) = \frac{1}{1 + e^{-z}}$) na camada de saída (`1`):**
   - Comprime qualquer número real para o intervalo $[0.0, 1.0]$, transformando a saída da rede numa **probabilidade de recomendação** (de `0%` a `100%`).
3. **Função de Perda `binaryCrossentropy`:**
   - Mede o erro da rede quando o alvo $y$ é binário (`1` = relevante/comprado, `0` = não relevante):
     $$\text{Loss} = -\frac{1}{N} \sum_{i=1}^{N} \left[ y_i \cdot \ln(\hat{y}_i) + (1 - y_i) \cdot \ln(1 - \hat{y}_i) \right]$$
   - Quanto mais próxima a previsão $\hat{y}$ estiver do rótulo real $y$, mais próximo de `0` fica o `loss`.
4. **Otimizador `adam(0.01)` (*Adaptive Moment Estimation*):**
   - Algoritmo que ajusta os pesos das camadas na direção que reduz o `loss`, adaptando a velocidade de aprendizado (iniciada em `0.01`) para cada parâmetro com base no histórico recente dos gradientes.

### 4.4. Exemplo Prático Completo em TypeScript

```ts
import * as tf from '@tensorflow/tfjs';

// 1. Calculamos o perfil médio da utilizadora Ana com tf.tidy (sem vazar memória)
const perfilAna = tf.tidy(() => {
  const compra1 = tf.tensor1d([0.40, 0.25, 0.16, 0.05]); // Câmera Compacta Preta
  const compra2 = tf.tensor1d([0.40, 0.25, 0.12, 0.07]); // Lente Zoom Preta

  // Empilha os 2 vetores 1D [4] numa matriz 2D [2, 4]
  const empilhados = tf.stack([compra1, compra2]);

  // Calcula a média vertical (eixo 0) -> [0.40, 0.25, 0.14, 0.06]
  const media = tf.mean(empilhados, 0);

  return Array.from(media.dataSync());
});

// 2. Criamos a rede neural sequencial (RN04: 128 -> 64 -> 32 -> 1)
const model = tf.sequential();
model.add(tf.layers.dense({ inputShape: [8], units: 128, activation: 'relu' }));
model.add(tf.layers.dense({ units: 64, activation: 'relu' }));
model.add(tf.layers.dense({ units: 32, activation: 'relu' }));
model.add(tf.layers.dense({ units: 1, activation: 'sigmoid' }));

model.compile({
  optimizer: tf.train.adam(0.01),
  loss: 'binaryCrossentropy',
  metrics: ['accuracy']
});

// 3. Montamos os tensores de treino xs [2, 8] e ys [2, 1]
const xs = tf.tensor2d([
  [...perfilAna, 0.40, 0.25, 0.18, 0.06], // Par 1: Ana + Câmera Pro (Combina -> 1)
  [...perfilAna, 0.00, 0.00, 0.02, 0.15]  // Par 2: Ana + Livro Infantil (Não combina -> 0)
]);
const ys = tf.tensor2d([[1], [0]]);

// 4. Treinamos o modelo e acompanhamos a queda do erro (loss) por época
await model.fit(xs, ys, {
  epochs: 15,
  callbacks: {
    onEpochEnd: (epoch, logs) => {
      console.log(`Época ${epoch + 1}: loss=${logs?.loss.toFixed(4)}`);
    }
  }
});

// 5. Geramos as probabilidades finais e liberamos os tensores da memória
const scores = tf.tidy(() => {
  const pred = model.predict(xs) as tf.Tensor;
  return Array.from(pred.dataSync());
});

xs.dispose();
ys.dispose();
model.dispose();
```


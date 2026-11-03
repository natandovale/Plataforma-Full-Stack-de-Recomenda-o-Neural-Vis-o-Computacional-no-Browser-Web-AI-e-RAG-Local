# AGENTS.md — Project Governance & AI Pair Programming

> Documento central de governança técnica, arquitetura e colaboração com agentes de IA.
>
> Este documento estabelece as diretrizes que devem ser seguidas por qualquer agente de IA que participe do desenvolvimento deste projeto.
>
> **Regra principal:** Nenhuma implementação deve começar sem que o agente compreenda o contexto, valide os requisitos e alinhe a abordagem técnica com o desenvolvedor.

---

# 1. Project Overview

## 1.1. Identificação

- **Nome do projeto:** Plataforma Full-Stack de Recomendação Neural, Visão Computacional no Browser (Web AI) e RAG Local com Neo4j
- **Descrição:** Plataforma Full-Stack integrada em Node.js 22+ e TypeScript que combina Recomendação Neural em tempo real no navegador (TensorFlow.js + Web Workers), Agente Visual com YOLOv8n + Pixi.js/Canvas, Assistente Multimodal Web 4.0 com cadeia de fallback (Gemini Nano -> Transformer.js -> Ollama -> OpenRouter) e Pipeline RAG Local com embeddings via Transformer.js, Neo4j Vector Index e prompts estruturados de 10 blocos (JSON Tabular / TOON).
- **Objetivo principal:** Prover uma experiência unificada de E-Commerce e Catálogo Inteligente com IA híbrida (Client-side Web AI 100% offline quando aplicável + Server-side RAG Local), eliminando bloqueios de UI, custos desnecessários de API de embeddings e alucinações de LLMs.
- **Público-alvo:** Utilizadores finais (compradores com histórico ou em cold start), operadores/lojistas (extração multimodal de documentos como cartão CNPJ e cenas) e engenheiros de IA/software.
- **Status:** PLANNING
- **Responsável técnico:** Developer & AI Pair Programmer

## 1.2. Visão do Produto

Aplicações tradicionais de IA dependem fortemente de chamadas externas caras e com alta latência para tarefas que poderiam ser executadas localmente no navegador ou em infraestrutura local leve, além de sofrerem com alucinações e alto consumo de tokens em pipelines RAG mal estruturados.

Esta plataforma resolve esses problemas integrando quatro pilares num fluxo único:
1. **Assistente Web 4.0 Multimodal:** Extração de dados estruturados (ex.: cartão CNPJ), descrição de cenas, processamento de áudio/texto e tradução nativa (`PT <-> EN`) usando `window.ai` (Gemini Nano) com fallback transparente para Transformer.js (in-browser), Ollama (container CPU local) e OpenRouter.
2. **Motor de Recomendação Neural no Browser:** Engenharia de features com normalização contínua min-max e `oneHotWeighted`, cálculo de perfil por `tf.stack` (ou fallback por idade normalizada para novos utilizadores) e treino de rede `tf.sequential` em Web Worker com visualização em tempo real (`tfvis`).
3. **Agente Visual Automatizado (YOLO + Pixi.js/Vídeo):** Captura de frames de `<canvas>` via `createImageBitmap`, pré-processamento em `tf.tidy` ($640 \times 640$), inferência assíncrona (`executeAsync`) em Web Worker (`classThreshold >= 0.40`) e cálculo de `centerX` para disparo automatizado de ações na vitrine interativa/câmera.
4. **Pipeline RAG Local com Neo4j e Prompts JSON/TOON:** Ingestão de PDFs e transcrições de vídeo em chunks semânticos, geração local de embeddings (`@huggingface/transformers`), indexação vetorial no Neo4j com metadados (`título`, `secção`, `minuto do vídeo`), prompt estruturado com 10 blocos anti-alucinação serializado em JSON Tabular ou TOON e roteamento entre Ollama (CPU Docker) e OpenRouter (cloud fallback).

## 1.3. Escopo

### Funcionalidades principais
- Engenharia de features e tensores (normalização min-max e `oneHotWeighted`) e perfil de utilizador (`tf.stack` + fallback cold start).
- Treinamento e inferência de rede neural sequencial (`128 -> 64 -> 32 -> 1 sigmoid`) em Web Worker com gráficos `tfvis` de `loss` e `accuracy`.
- Vitrine interativa em Pixi.js e feed de vídeo/câmera em `<canvas>` monitorados por Agente Visual YOLOv8n em Web Worker com cálculo de `centerX` e disparo de ação.
- Assistente Multimodal e Tradutor (`PT <-> EN`) com arquitetura de adaptadores em cadeia: `Gemini Nano (window.ai)` -> `Transformer.js (Web Worker)` -> `Ollama (Docker CPU)` -> `OpenRouter`.
- Pipeline RAG Local com ingestão de PDFs/transcrições, embeddings em Node.js puro (`Xenova/all-MiniLM-L6-v2`), persistência e busca vetorial no Neo4j.
- Motor de Prompts de 10 blocos anti-alucinação com serialização JSON Tabular e TOON (Token Oriented Object Notation), validação Zod/Ajv e orquestração Ollama -> OpenRouter.

### Fora do escopo
- Processamento de pagamentos reais ou integração com gateways financeiros externos.
- Treinamento distribuído de LLMs de grande porte em clusters GPU na nuvem.
- Aplicativos nativos mobile (iOS/Android fora do navegador web).

### Restrições e premissas
- **Runtime obrigatório:** Node.js 22+ e TypeScript estrito (`strict: true`).
- **Execução de Ollama em CPU:** O container Docker do Ollama rodará em modo CPU com modelos leves pré-instalados/auto-provisionados (`qwen2.5:1.5b` para texto e `moondream` para visão).
- **Contorno de hardware para Gemini Nano:** Como a máquina local pode não suportar nativamente o Chrome Built-in AI (`window.ai`), toda chamada ao Assistente Web 4.0 deve passar pela cadeia de fallback (`Gemini Nano -> Transformer.js -> Ollama -> OpenRouter`).
- **UI Non-blocking:** Nenhum treino ou inferência pesada de TensorFlow.js/YOLO pode bloquear a main thread do navegador; o uso de Web Workers e `tf.tidy` é obrigatório.

---

# 2. Architecture & Technical Decisions

## 2.1. Padrão Arquitetural

- **Arquitetura adotada:** Modular Monolith com Clean Architecture / Hexagonal (Ports & Adapters) em Monorepo (`npm workspaces`).
- **Estilo de comunicação:** REST (JSON) + Server-Sent Events (SSE para streaming de LLMs) entre Frontend e Backend; Mensageria Assíncrona (`postMessage` + `Transferable Objects` como `ImageBitmap`) entre UI e Web Workers.
- **Organização:** Monorepo (`packages/shared`, `packages/backend`, `packages/frontend`).
- **Estratégia de persistência:** Neo4j 5.x (Grafo + Vector Index para chunks e metadados do RAG) + IndexedDB/Cache API no navegador (cache offline de modelos TF.js/ONNX).

### Princípios arquiteturais

1. Separação de responsabilidades.
2. Baixo acoplamento entre módulos.
3. Alta coesão.
4. Inversão de dependência (Ports & Adapters para provedores de IA e banco de dados).
5. Independência das regras de negócio e fórmulas matemáticas em relação a frameworks de UI ou HTTP.
6. Código testável e extensível.
7. Evitar abstrações prematuras.

## 2.2. Regras de Dependência

- `packages/shared` não depende de nenhum outro pacote interno; exporta apenas contratos, tipos, schemas (Zod/Ajv), constantes de domínio e serializadores puros (JSON Tabular e TOON).
- `packages/backend` e `packages/frontend` podem depender de `packages/shared`, mas não podem importar código diretamente um do outro.
- Camadas de domínio (fórmulas de normalização, `oneHotWeighted`, cálculo de `centerX`, montagem dos 10 blocos do prompt) não devem depender de React, Fastify ou drivers de banco.

Regras obrigatórias:

- Regras de domínio não devem depender de frameworks externos.
- A camada de apresentação não deve implementar regras de negócio.
- A infraestrutura deve implementar contratos definidos pelas camadas internas, quando aplicável.
- Dependências entre módulos devem ser explícitas.
- Não criar dependências circulares.

## 2.3. Architecture Decision Records (ADR)

Decisões arquiteturais relevantes devem ser documentadas.

Local: `docs/architecture/decisions/`

Formato sugerido:

- Contexto.
- Problema.
- Decisão tomada.
- Alternativas consideradas.
- Consequências.
- Data.

---

# 3. Technology Stack

## 3.1. Tecnologias

| Camada | Tecnologia | Versão |
|---|---|---|
| Runtime | Node.js + TypeScript | Node `22.x LTS` / TS `5.7+` |
| Backend | Fastify + Zod Type Provider | `5.x` |
| Frontend | React + Vite + TypeScript | React `19.x` / Vite `6.x` |
| Web ML & Gráficos | TensorFlow.js + tfvis + Pixi.js | TF.js `4.22+` / Pixi.js `8.x` |
| Database (Vector & Graph) | Neo4j Community (Vector Index) | `5.26-community` |
| Local Embeddings & Web AI | `@huggingface/transformers` | `3.x` |
| Local & Cloud LLMs | Ollama (Docker CPU) + OpenRouter | `ollama/ollama:latest` |
| Infrastructure | Docker & Docker Compose | Compose `v2` |
| Testing | Vitest + Playwright (MCP) | Vitest `3.x` / Playwright `1.50+` |

## 3.2. Bibliotecas e Frameworks

| Biblioteca | Responsabilidade | Serviço/Módulo |
|---|---|---|
| `@tensorflow/tfjs` | Tensores, modelo `tf.sequential` e inferência `yolov8n` (`executeAsync`) | `frontend` (`recommendation`, `visual-agent`) |
| `@tensorflow/tfjs-vis` | Visualização em tempo real de curvas de `loss` e `accuracy` | `frontend` (`recommendation`) |
| `pixi.js` | Renderização de vitrine interativa 2D no `<canvas>` para o Agente Visual | `frontend` (`visual-agent`) |
| `@huggingface/transformers` | Embeddings locais (`Xenova/all-MiniLM-L6-v2`) no backend e fallback Web AI no frontend | `backend` (`rag`), `frontend` (`web-ai`) |
| `neo4j-driver` | Persistência de nós de documento/chunks e consulta ao índice vetorial | `backend` (`rag`) |
| `pdf-parse` | Leitura e extração de texto de arquivos PDF para o pipeline RAG | `backend` (`rag`) |
| `zod` / `ajv` | Validação de variáveis de ambiente, DTOs HTTP e schemas de JSON Prompts | `shared`, `backend`, `frontend` |

Regras:

- Priorizar bibliotecas consolidadas e mantidas.
- Evitar adicionar dependências sem justificativa.
- Verificar compatibilidade de versões.
- Não substituir tecnologias definidas sem aprovação.
- Documentar novas dependências relevantes.

---

# 4. Repository Structure

## 4.1. Estrutura de Diretórios

Estrutura aprovada:

```text
project-root/
├── docs/
│   ├── AGENTS.md
│   ├── architecture/
│   │   ├── overview.md
│   │   └── decisions/
│   │       └── ADR-001-webai-and-llm-fallback-chain.md
│   ├── requirements/
│   │   └── specification.md
│   ├── technical/
│   │   └── rag-prompt-and-feature-engineering.md
│   └── development/
│       ├── development-plan.md
│       ├── progress.md
│       └── development-log.md
├── packages/
│   ├── shared/
│   │   ├── src/
│   │   │   ├── contracts/
│   │   │   ├── domain/
│   │   │   ├── schemas/
│   │   │   └── serializers/
│   │   └── package.json
│   ├── backend/
│   │   ├── src/
│   │   │   ├── config/
│   │   │   ├── modules/
│   │   │   │   ├── catalog/
│   │   │   │   ├── llm-router/
│   │   │   │   └── rag/
│   │   │   └── server.ts
│   │   └── package.json
│   └── frontend/
│       ├── src/
│       │   ├── modules/
│       │   │   ├── recommendation/
│       │   │   ├── visual-agent/
│       │   │   ├── web-ai/
│       │   │   └── rag-chat/
│       │   ├── workers/
│       │   └── main.tsx
│       └── package.json
├── tests/
│   ├── unit/
│   ├── integration/
│   └── e2e/
├── infrastructure/
│   ├── docker-compose.yml
│   └── ollama/
│       ├── Dockerfile
│       └── entrypoint.sh
├── .env.example
├── .gitignore
├── AGENTS.md
├── package.json
├── tsconfig.base.json
└── README.md
```

## 4.2. Organização de Arquivos

O agente deve respeitar as seguintes convenções:

- Models & Entities: `packages/*/src/modules/<module>/domain/` ou `packages/shared/src/domain/`
- DTOs & Schemas (Zod/Ajv): `packages/shared/src/schemas/`
- Interfaces & Contracts: `packages/shared/src/contracts/`
- Serializers (JSON Tabular / TOON): `packages/shared/src/serializers/`
- Services & Use Cases: `packages/*/src/modules/<module>/services/`
- Repositories & Adapters: `packages/*/src/modules/<module>/adapters/`
- Controllers/Endpoints: `packages/backend/src/modules/<module>/controllers/`
- Jobs/Workers (Web Workers): `packages/frontend/src/workers/`
- Configurations: `packages/backend/src/config/`
- Tests: `tests/unit/`, `tests/integration/`, `tests/e2e/` (ou co-localizados `*.spec.ts` conforme convenção do workspace)

Não criar novos diretórios ou reorganizar estruturas existentes sem justificativa técnica.

---

# 5. Environment & Configuration

## 5.1. Variáveis de Ambiente

Todas as configurações sensíveis devem ser externalizadas.

| Variável | Descrição | Obrigatória |
|---|---|---|
| `NODE_ENV` | Ambiente de execução (`development`, `test`, `production`) | Sim |
| `PORT` | Porta do servidor HTTP Fastify (default: `3001`) | Sim |
| `NEO4J_URI` | URI Bolt do Neo4j (ex.: `bolt://localhost:7687`) | Sim |
| `NEO4J_USER` | Utilizador do Neo4j (ex.: `neo4j`) | Sim |
| `NEO4J_PASSWORD` | Senha do banco Neo4j | Sim |
| `OLLAMA_BASE_URL` | Endpoint do container Ollama (ex.: `http://localhost:11434`) | Sim |
| `OLLAMA_TEXT_MODEL` | Modelo de texto default no Ollama CPU (`qwen2.5:1.5b`) | Sim |
| `OLLAMA_VISION_MODEL` | Modelo multimodal leve no Ollama CPU (`moondream`) | Sim |
| `OPENROUTER_API_KEY` | Chave de API para fallback em nuvem no OpenRouter | Não (obrigatória apenas se acionar cloud fallback real) |
| `OPENROUTER_DEFAULT_MODEL` | Modelo de fallback no OpenRouter (`google/gemini-2.0-flash-exp:free`) | Sim |
| `EMBEDDING_MODEL` | Modelo local do Transformer.js (`Xenova/all-MiniLM-L6-v2`) | Sim |

## 5.2. Convenções

- Nunca armazenar credenciais diretamente no código.
- Nunca versionar arquivos `.env` com segredos.
- Manter `.env.example` atualizado.
- Validar variáveis obrigatórias durante a inicialização com Zod.
- Separar configurações de desenvolvimento, testes e produção.
- Não expor informações sensíveis em logs.

---

# 6. Domain Rules & Business Logic

## 6.1. Regras de Domínio

1. **RN01 — Normalização de Variáveis Contínuas:**
   - As variáveis contínuas (`idade` e `preço`) devem ser normalizadas no intervalo $[0, 1]$ pela fórmula:
     $$\text{norm}(x) = \frac{x - \min}{\max - \min}$$
   - Se $\max = \min$, o resultado deve ser $0$ para evitar divisão por zero.
2. **RN02 — One-Hot Encoding Ponderado (`oneHotWeighted`):**
   - As features do produto combinam variáveis categóricas e contínuas com os seguintes pesos padrão aprovados (respeitando a ordem de importância: categoria > cor > preço > idade média):
     - `categoria`: peso **$0.40$**
     - `cor`: peso **$0.25$**
     - `preço` (normalizado): peso **$0.20$**
     - `idade média dos compradores por produto` (normalizada): peso **$0.15$**
3. **RN03 — Vetor de Perfil do Utilizador e Cold Start:**
   - Para utilizadores com histórico de compras, o vetor de perfil é calculado pela média dos tensores empilhados (`tf.stack`) dos produtos comprados.
   - Para novos utilizadores sem histórico (cold start), aplica-se o fallback baseado na idade normalizada do utilizador.
4. **RN04 — Rede Neural de Recomendação (`tf.sequential`):**
   - Camadas ocultas densas: `128` neurônios (`relu`) -> `64` neurônios (`relu`) -> `32` neurônios (`relu`).
   - Camada de saída: `1` neurônio (`sigmoid`).
   - Otimizador: `adam` com taxa de aprendizado `0.01`.
   - Função de perda: `binaryCrossentropy`.
   - Execução obrigatória em Web Worker com envio de métricas por época para `tfvis`.
5. **RN05 — Agente Visual YOLO no Browser:**
   - Captura via `createImageBitmap` a partir de `<canvas>` (suportando tanto cena interativa Pixi.js quanto stream de vídeo/câmera).
   - Pré-processamento dentro de `tf.tidy`: `tf.browser.fromPixels` -> `tf.image.resizeBilinear([640, 640])` -> `.div(255)` -> `.expandDims(0)`.
   - Inferência assíncrona via `executeAsync` em Web Worker.
   - Filtragem: considerar apenas detecções com `classThreshold >= 0.40` ($40\%$).
   - Cálculo do centro horizontal da bounding box:
     $$\text{centerX} = x_1 + \frac{x_2 - x_1}{2}$$
   - O `centerX` calculado dispara uma ação automatizada no ambiente visual (ex.: movimentar o agente/cursor e inspecionar o item detectado).
6. **RN06 — Cadeia de Fallback do Assistente Multimodal Web 4.0:**
   - Deve suportar texto, áudio, imagens (ex.: extração de campos de cartão CNPJ e descrição de cenas) e tradução `PT <-> EN` com controle de `temperature`, `topK` e streaming.
   - Ordem obrigatória de tentativa/fallback: `1. Gemini Nano (window.ai / Native Translation)` -> `2. Transformer.js (In-Browser Worker)` -> `3. Ollama (Container CPU)` -> `4. OpenRouter`.
7. **RN07 — Indexação RAG Local no Neo4j:**
   - Extração de texto de PDFs e transcrições, divisão em chunks semânticos e geração local de embeddings (`384` dimensões via `Xenova/all-MiniLM-L6-v2`).
   - Metadados obrigatórios em cada chunk: `title` (título), `section` (secção) e `videoMinute` (minuto do vídeo).
8. **RN08 — Prompt Estruturado de 10 Blocos Anti-Alucinação e Serialização:**
   - Todo prompt de consulta RAG deve conter exatamente os 10 blocos: `1. contexto`, `2. tom`, `3. fonte da verdade`, `4. contrato operacional`, `5. exemplos`, `6. histórico`, `7. pedido`, `8. raciocínio`, `9. formato`, `10. restrições`.
   - O bloco `fonte da verdade` deve suportar serialização dos chunks recuperados tanto em **JSON Tabular** quanto em **TOON (Token Oriented Object Notation)**.
   - O prompt e a resposta estruturada devem ser validados com Zod/Ajv.
   - Orquestração de execução: `1. Ollama (local)` -> `2. OpenRouter (fallback)`.

O agente deve:

- Preservar as regras de negócio documentadas.
- Não inventar comportamentos para requisitos ambíguos.
- Identificar possíveis conflitos entre regras.
- Solicitar esclarecimentos quando uma decisão impactar o domínio.
- Evitar espalhar regras de negócio por controllers, repositories e componentes de apresentação.

## 6.2. Services

- Cada serviço deve possuir uma responsabilidade clara.
- Evitar classes com múltiplas responsabilidades.
- Não duplicar regras de negócio.
- Priorizar composição em vez de herança quando apropriado.
- Utilizar interfaces quando houver necessidade real de desacoplamento (ex.: `LLMProvider`, `WebAIProvider`, `VectorRepository`).

## 6.3. Jobs & Background Workers

1. **`recommendation.worker.ts`:** Recebe catálogo e histórico do utilizador, constrói tensores, treina o modelo `tf.sequential` em background, emite eventos de época (`epochEnd`) para atualização do `tfvis` na UI e retorna o ranking de produtos recomendados.
2. **`yolo.worker.ts`:** Recebe `ImageBitmap` transferido da thread principal, executa o pré-processamento em `tf.tidy`, roda `model.executeAsync()`, filtra caixas com `score >= 0.40`, calcula `centerX` e emite comandos de ação para o palco Pixi.js/UI.
3. **`webai-transformers.worker.ts`:** Executa modelos locais do `@huggingface/transformers` no navegador quando `window.ai` não estiver disponível.

Diretrizes:

- Implementar tratamento de falhas e fallback gracioso.
- Garantir descarte explícito de tensores (`tf.dispose` / `tf.tidy`) e `ImageBitmap.close()`.
- Evitar concorrência de frames no worker YOLO (descartar ou enfileirar frames se uma inferência ainda estiver em andamento).
- Definir estratégias de retry e timeout nas chamadas a Ollama/OpenRouter.
- Implementar logs e telemetria de latência.

## 6.4. Models & Data

- Validar payloads HTTP e mensagens de Workers com schemas compartilhados em `@platform/shared`.
- Diferenciar modelos de domínio e modelos de transporte quando necessário.
- Evitar expor entidades internas diretamente nas APIs.
- Validar dados nas fronteiras da aplicação.
- Preservar integridade e consistência dos dados.

---

# 7. Code Quality Standards

## 7.1. Princípios

O desenvolvimento deve observar:

- SOLID.
- DRY.
- KISS.
- Separation of Concerns.
- Clean Code.
- Fail Fast.
- Explicit over Implicit.

Esses princípios devem ser aplicados com pragmatismo, evitando complexidade desnecessária.

## 7.2. Convenções de Código

- Seguir as convenções oficiais do TypeScript (`strict: true`, sem `any` implícito ou injustificado).
- Utilizar nomes descritivos em inglês para código/símbolos e manter termos de domínio claros.
- Manter métodos pequenos, puros quando possível, e coesos.
- Evitar comentários que apenas repetem o código.
- Documentar decisões e comportamentos não óbvios.
- Evitar código morto e abstrações sem utilização.

## 7.3. Tratamento de Erros

- Não utilizar exceções como fluxo normal de controle.
- Não ocultar exceções; em cadeias de fallback (Web AI / LLM Router), registrar o motivo da falha do provedor anterior antes de acionar o próximo.
- Preservar informações relevantes para diagnóstico.
- Padronizar respostas de erro na API Fastify.
- Não expor detalhes internos ou credenciais ao consumidor da API.

---

# 8. Testing Strategy

## 8.1. Estratégia de Testes

| Tipo | Objetivo | Ferramenta |
|---|---|---|
| Unitários | Fórmulas matemáticas (`min-max`, `oneHotWeighted`, `centerX`), serializadores (`JSON Tabular`, `TOON`), montagem dos 10 blocos e regras isoladas | `Vitest` |
| Integração | Repositório Neo4j Vector Index, geração de embeddings com Transformer.js, cadeia de fallback `Ollama -> OpenRouter` e Workers | `Vitest` |
| E2E | Fluxo único integrado no navegador (Web AI -> Recomendação -> Agente Visual Pixi/YOLO -> Chat RAG) | `Playwright` |
| Contrato | Validação de schemas de prompts de 10 blocos, extração de CNPJ e payloads entre UI, Workers e API | `Zod` + `Ajv` + `Vitest` |

## 8.2. Test-Driven Development (TDD)

Adotar o ciclo:

1. **Red:** escrever um teste que represente o comportamento esperado e falhe.
2. **Green:** implementar o mínimo necessário para passar.
3. **Refactor:** melhorar a implementação preservando os testes.

Regras:

- Não implementar funcionalidades complexas sem definir previamente seus critérios de aceitação.
- Não escrever testes que apenas reproduzam a implementação.
- Testar comportamentos, não detalhes internos.
- Não remover ou enfraquecer testes para fazer uma implementação passar.
- Executar os testes relevantes após cada alteração.

---

# 9. AI Pair Programming — Extreme Programming

## 9.1. Papel do Agente

O agente deve atuar como um parceiro técnico de programação, não como um executor autônomo de tarefas extensas.

Responsabilidades:

- Analisar problemas antes de propor soluções.
- Explicar decisões técnicas relevantes.
- Questionar requisitos inconsistentes.
- Propor alternativas quando houver trade-offs.
- Desenvolver incrementalmente.
- Manter o desenvolvedor envolvido nas decisões.
- Priorizar soluções simples e testáveis.

O desenvolvedor permanece responsável pelas decisões finais.

## 9.2. Ciclo de Desenvolvimento

### Etapa 1 — Understand
- Ler este documento.
- Identificar o contexto da tarefa.
- Consultar os documentos relevantes.
- Inspecionar a implementação existente.
- Identificar dependências e impactos.

### Etapa 2 — Discuss
Antes de implementar:

- Apresentar a interpretação do requisito.
- Identificar dúvidas e ambiguidades.
- Apresentar a abordagem técnica proposta.
- Identificar os arquivos que provavelmente serão modificados.
- Apontar riscos e impactos arquiteturais.

Aguardar alinhamento do desenvolvedor quando houver decisões relevantes ou ambiguidades que alterem o resultado.

### Etapa 3 — Plan
Dividir a implementação em pequenas unidades de trabalho.

Cada unidade deve possuir:

- Objetivo.
- Comportamento esperado.
- Arquivos envolvidos.
- Testes necessários.
- Critérios de aceitação.

### Etapa 4 — Test First
- Definir os testes antes da implementação.
- Escrever testes que expressem o comportamento esperado.
- Validar que os testes falham pelo motivo esperado.

### Etapa 5 — Implement
- Implementar somente o necessário.
- Evitar antecipar funcionalidades futuras.
- Não modificar áreas não relacionadas.
- Seguir os padrões existentes.

### Etapa 6 — Refactor
- Eliminar duplicações.
- Melhorar legibilidade.
- Revisar responsabilidades.
- Verificar aderência à arquitetura.
- Preservar os testes existentes.

### Etapa 7 — Review
Apresentar:

- O que foi implementado.
- Arquivos modificados.
- Testes executados e resultados.
- Decisões técnicas tomadas.
- Débitos técnicos identificados.
- Próximo incremento recomendado.

## 9.3. Práticas de Extreme Programming

| Prática | Aplicação |
|---|---|
| Small Releases | Entregas pequenas e frequentes |
| TDD | Testes antes da implementação |
| Refactoring | Melhoria contínua |
| Simple Design | Solução mais simples que atende ao requisito |
| Pair Programming | Desenvolvedor e IA trabalhando em conjunto |
| Continuous Integration | Integração e validação frequentes |
| Collective Ownership | Código compreensível e mantido por todos |
| Feedback | Validação constante dos resultados |

## 9.4. Regras de Colaboração

- Não implementar múltiplas funcionalidades independentes em uma única alteração.
- Não executar refatorações amplas sem necessidade.
- Não assumir requisitos que não foram especificados.
- Não alterar contratos públicos sem avaliar compatibilidade.
- Não adicionar dependências sem justificar.
- Não considerar uma tarefa concluída apenas porque o código foi gerado.
- Sempre informar limitações e testes não executados.
- Solicitar aprovação antes de operações destrutivas ou alterações irreversíveis.

---

# 10. Documentation Governance

A documentação deve evoluir junto com o projeto e representar fielmente tanto o planejamento quanto o histórico de desenvolvimento.

## 10.1. Fonte da Verdade

O `AGENTS.md` (mantido sincronizado na raiz e em `docs/AGENTS.md`) é a referência central para:

- Arquitetura.
- Stack tecnológica.
- Organização do repositório.
- Convenções.
- Regras de desenvolvimento.
- Governança de IA.

Documentos específicos devem complementar, e não contradizer, este arquivo.

## 10.2. Atualização Obrigatória

Atualizar a documentação quando ocorrer:

- Mudança arquitetural.
- Inclusão ou remoção de tecnologias.
- Alteração na estrutura do repositório.
- Inclusão de novos módulos ou serviços.
- Alteração relevante nas regras de domínio.
- Mudança nos padrões de desenvolvimento.
- Alteração nas configurações de ambiente.

## 10.3. Documentos Complementares

| Documento | Responsabilidade |
|---|---|
| `AGENTS.md` / `docs/AGENTS.md` | Governança e instruções para IA |
| `README.md` | Apresentação e execução do projeto |
| `docs/architecture/overview.md` | Visão arquitetural e fluxo integrado dos 4 módulos |
| `docs/architecture/decisions/` | Architecture Decision Records (ADRs) |
| `docs/requirements/specification.md` | Requisitos funcionais, não funcionais e regras de negócio |
| `docs/technical/rag-prompt-and-feature-engineering.md` | Especificação matemática de features, YOLO, JSON Tabular, TOON e 10 blocos |
| `docs/development/development-plan.md` | Planejamento das etapas e entregas (Small Releases) |
| `docs/development/progress.md` | Estado atual das funcionalidades planejadas |
| `docs/development/development-log.md` | Diário cronológico de acontecimentos do desenvolvimento |

## 10.4. Progress Tracking

O arquivo `docs/development/progress.md` deve representar o estado atual do planejamento e do escopo do projeto.

### Informações obrigatórias

- Estado atual do projeto.
- Milestone atual.
- Funcionalidades planejadas e concluídas.
- Funcionalidades em andamento.
- Funcionalidades pendentes.
- Critérios de aceitação.
- Próximos incrementos.

### Regras de atualização

1. Atualizar após a conclusão de incrementos relacionados ao planejamento.
2. Não marcar funcionalidades como concluídas sem validação.
3. Manter as funcionalidades alinhadas ao escopo aprovado.
4. Não utilizar este arquivo como histórico de alterações técnicas.
5. Não registrar bugs, correções ou pequenos ajustes individualmente.
6. Não adicionar funcionalidades não planejadas como se fizessem parte do escopo aprovado.
7. Manter o planejamento alinhado ao estado real do projeto.

## 10.5. Development Log — Diário de Bordo

O arquivo `docs/development/development-log.md` deve funcionar como um diário de bordo cronológico de toda a evolução técnica relevante da aplicação.

### Níveis de Importância

| Nível | Identificador | Utilização |
|---|---|---|
| Crítico | CRITICAL | Falhas graves, segurança, perda de dados ou indisponibilidade |
| Alto | HIGH | Bugs, regressões, falhas funcionais e problemas de integração |
| Médio | MEDIUM | Features, implementações, refatorações e melhorias relevantes |
| Baixo | LOW | Ajustes simples, pequenas melhorias e alterações internas |

### Relação entre os documentos

| Documento | Pergunta que responde |
|---|---|
| `development-plan.md` | O que pretendemos desenvolver? |
| `progress.md` | Em que ponto do planejamento estamos? |
| `development-log.md` | O que aconteceu durante o desenvolvimento? |

---

# 11. Definition of Done (DoD)

Uma tarefa somente pode ser considerada concluída quando:

- [ ] Requisitos atendidos.
- [ ] Critérios de aceitação validados.
- [ ] Testes relevantes implementados (seguindo TDD Red-Green-Refactor).
- [ ] Testes executados com sucesso.
- [ ] Código revisado.
- [ ] Arquitetura respeitada.
- [ ] Nenhuma regressão conhecida introduzida.
- [ ] Documentação atualizada quando necessário.
- [ ] Configurações e dependências revisadas.
- [ ] `progress.md` atualizado quando houver impacto no planejamento.
- [ ] `development-log.md` atualizado quando houver acontecimento técnico relevante.
- [ ] Limitações e pendências comunicadas.

---

# 12. Initial Instructions for the AI Agent

Ao iniciar uma nova sessão ou trabalhar neste repositório:

1. Leia integralmente este documento (`AGENTS.md`).
2. Leia o `README.md` e os documentos complementares relevantes.
3. Consulte `docs/development/progress.md` para compreender o estado atual do planejamento.
4. Consulte `docs/development/development-plan.md` para identificar as entregas planejadas.
5. Consulte `docs/development/development-log.md` para recuperar o histórico técnico recente.
6. Inspecione a estrutura atual do repositório.
7. Identifique o estado atual de implementação.
8. Verifique se a implementação está consistente com a documentação.
9. Não altere código antes de compreender o contexto da tarefa.
10. Trabalhe incrementalmente, seguindo o processo de Pair Programming + XP.
11. Atualize os documentos correspondentes após cada incremento.
12. Ao identificar inconsistências na documentação, apresente-as antes de realizar alterações estruturais.

## Comportamento padrão

**Não tente resolver o projeto inteiro de uma vez.**

Trabalhe em pequenos incrementos, discuta decisões relevantes, implemente o mínimo necessário, valide com testes e mantenha a documentação, o planejamento e o diário de bordo atualizados.

O objetivo é construir software de forma colaborativa, previsível, testável e sustentável.

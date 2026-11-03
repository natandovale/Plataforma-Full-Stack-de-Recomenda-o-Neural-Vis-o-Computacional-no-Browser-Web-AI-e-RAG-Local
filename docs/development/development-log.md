# Development Log

> Diário cronológico dos acontecimentos técnicos durante o desenvolvimento da aplicação.

---

## 2026-11-03

### [MEDIUM] [FEATURE] Servidor HTTP Fastify, Catálogo Inicial e Endpoints RAG/WebAI Fallback (Incremento 2.3)

**Categoria:** Feature (TDD)
**Importância:** Média
**Horário:** 18:51

**Descrição:**
Implementados e validados via testes de integração no pacote `@platform/backend`:
- `catalog-data.ts`: catálogo inicial de produtos com categorias, cores, preços, idade média dos compradores, labels YOLO, perfis de utilizadores (com histórico e cold start) e documentos de conhecimento para o RAG.
- `createBackendApp` (`app.ts`) e `server.ts`: rotas HTTP Fastify com CORS e validação Zod para `/api/health`, `/api/catalog`, `/api/rag/ingest`, `/api/rag/query` e `/api/webai/fallback` (incluindo extração estruturada de cartão CNPJ).

**Módulos afetados:**
- `packages/backend/src/modules/catalog/catalog-data.ts`
- `packages/backend/src/app.ts`
- `packages/backend/src/server.ts`
- `tests/integration/backend-fastify-api.spec.ts`

---

### [MEDIUM] [FEATURE] Geração Local de Embeddings, Orquestrador LLMRouter e RagService (Incremento 2.2)

**Categoria:** Feature (TDD)
**Importância:** Média
**Horário:** 18:45

**Descrição:**
Implementados e validados via TDD no pacote `@platform/backend`:
- `TransformersJsLocalEmbedder` e `DeterministicHashEmbedder`: geração local de embeddings de `384` dimensões usando `@huggingface/transformers` (`Xenova/all-MiniLM-L6-v2` com `pooling: 'mean'` e `normalize: true`).
- `LLMRouter`, `OllamaAdapter` e `OpenRouterAdapter`: orquestração com cadeia de fallback (`Ollama CPU -> OpenRouter`) preservando os motivos de falha do provedor primário em `fallbackErrors`.
- `RagService`: fluxo integrado de ingestão semântica, busca vetorial, montagem e validação dupla (Zod + Ajv) do prompt de 10 blocos anti-alucinação em `TOON` / `JSON_TABULAR` e telemetria de economia de tokens.

**Módulos afetados:**
- `packages/backend/src/modules/rag/adapters/local-embedder.ts`
- `packages/backend/src/modules/llm-router/services/llm-router.ts`
- `packages/backend/src/modules/rag/services/rag-service.ts`
- `tests/unit/backend-embedder-llmrouter-and-rag.spec.ts`

---

### [MEDIUM] [FEATURE] Configuração Zod, Chunking Semântico e Repositório Vetorial Neo4j (Incremento 2.1)

**Categoria:** Feature (TDD)
**Importância:** Média
**Horário:** 18:31

**Descrição:**
Implementados e testados via TDD no pacote `@platform/backend`:
- `parseBackendEnv`: validação das variáveis de ambiente com Zod e defaults para Ollama CPU (`qwen2.5:1.5b`, `moondream`), Neo4j e Transformer.js (`Xenova/all-MiniLM-L6-v2`).
- `chunkDocumentSemantically`: divisão de documentos/transcrições em chunks semânticos preservando `title`, `section` e `videoMinute`.
- `Neo4jVectorRepository` e `InMemoryVectorRepository`: criação de índice vetorial no Neo4j (`rag_chunk_vector_idx` com `384` dimensões e função `cosine`), persistência de grafos `(:Document)-[:HAS_CHUNK]->(:Chunk)` e busca semântica ordenada por score.

**Módulos afetados:**
- `packages/backend/src/config/env.ts`
- `packages/backend/src/modules/rag/services/semantic-chunker.ts`
- `packages/backend/src/modules/rag/adapters/neo4j-vector-repository.ts`
- `tests/unit/backend-rag-chunking-and-repo.spec.ts`

---

### [MEDIUM] [FEATURE] Serializadores JSON Tabular / TOON e Motor de Prompt de 10 Blocos Anti-Alucinação (Incremento 1.2)

**Categoria:** Feature (TDD)
**Importância:** Média
**Horário:** 18:24

**Descrição:**
Implementados e validados via TDD no pacote `@platform/shared`:
- `serializeChunksToJsonTabular` e `serializeChunksToToon`: serialização econômica de chunks do Neo4j com metadados obrigatórios (`id`, `title`, `section`, `videoMinute`, `score`, `text`) e sanitização de delimitadores.
- `buildTenBlockRagPrompt`, `validateTenBlockPromptWithZod`, `validateTenBlockPromptWithAjv` e `renderTenBlockPromptToText`: construção e validação dupla (Zod + Ajv JSON Schema) exigindo os 10 blocos anti-alucinação (`contexto`, `tom`, `fonteDaVerdade`, `contratoOperacional`, `exemplos`, `historico`, `pedido`, `raciocinio`, `formato`, `restricoes`).

**Módulos afetados:**
- `packages/shared/src/serializers/source-of-truth-serializer.ts`
- `packages/shared/src/schemas/rag-prompt-schema.ts`
- `packages/shared/src/index.ts`
- `tests/unit/rag-prompt-and-serializers.spec.ts`

---

### [MEDIUM] [FEATURE] Implementação do Domínio Matemático de Engenharia de Features e Geometria YOLO (Incremento 1.1)

**Categoria:** Feature (TDD)
**Importância:** Média
**Horário:** 18:19

**Descrição:**
Implementadas e testadas via TDD (Red -> Green -> Refactor) as regras matemáticas de domínio no pacote `@platform/shared`:
- `normalizeMinMax`: normalização contínua de idade e preço em $[0, 1]$ com proteção para $\max = \min$.
- `oneHotWeighted` e `buildProductFeatureVector`: codificação categórica ponderada respeitando a hierarquia `categoria (0.40) > cor (0.25) > preço (0.20) > idade média (0.15)`.
- `computeUserProfileVector`: cálculo do perfil pela média empilhada dos produtos comprados e fallback cold start baseado na idade normalizada.
- `calculateBoundingBoxCenterX` e `filterAndComputeDetections`: filtro de confiança $\ge 0.40$ e cálculo de $\text{centerX} = x_1 + (x_2 - x_1)/2$.

**Módulos afetados:**
- `packages/shared/src/domain/feature-engineering.ts`
- `packages/shared/src/domain/yolo-geometry.ts`
- `packages/shared/src/index.ts`
- `tests/unit/domain-math.spec.ts`

---

### [LOW] [INFRA] Bootstrap estrutural do Monorepo e Infraestrutura Docker CPU

**Categoria:** Infrastructure & Bootstrap
**Importância:** Baixa
**Horário:** 12:35

**Descrição:**
Criada a estrutura inicial do monorepo (`packages/shared`, `packages/backend`, `packages/frontend`, `tests/`, `infrastructure/`), arquivos de configuração TypeScript (`tsconfig.base.json`), variáveis de ambiente de exemplo (`.env.example`) e definição do `docker-compose.yml` com Neo4j 5.26 e container Ollama CPU com script `entrypoint.sh` para provisionamento automático dos modelos leves (`qwen2.5:1.5b` e `moondream`). Nenhuma regra de negócio foi implementada nesta etapa.

**Módulos afetados:**
- `package.json`, `tsconfig.base.json`, `.env.example`, `.gitignore`
- `packages/shared/`, `packages/backend/`, `packages/frontend/`
- `infrastructure/docker-compose.yml`, `infrastructure/ollama/`

---

### [MEDIUM] [DOCS] Estruturação da Governança Técnica e Especificação da Plataforma

**Categoria:** Documentation & Architecture
**Importância:** Média
**Horário:** 12:10

**Descrição:**
Realizada a análise dos requisitos do produto, definição da arquitetura em Monorepo (`@platform/shared`, `@platform/backend`, `@platform/frontend`), estratégia de containerização do Ollama em CPU e cadeia de fallback para o Assistente Multimodal Web 4.0 (`Gemini Nano -> Transformer.js -> Ollama -> OpenRouter`). Preenchido o `AGENTS.md` e criados os documentos complementares de requisitos, ADR, especificação técnica e plano de entregas incrementais.

**Módulos afetados:**
- `AGENTS.md` / `docs/AGENTS.md`
- `docs/requirements/specification.md`
- `docs/architecture/decisions/ADR-001-webai-and-llm-fallback-chain.md`
- `docs/technical/rag-prompt-and-feature-engineering.md`
- `docs/development/development-plan.md`
- `docs/development/progress.md`

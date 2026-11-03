# Development Log

> Diário cronológico dos acontecimentos técnicos durante o desenvolvimento da aplicação.

---

## 2026-11-03

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

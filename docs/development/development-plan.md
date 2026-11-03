# Development Plan — Small Releases (XP)

> Planejamento incremental guiado por Test-Driven Development (TDD) e entregas pequenas, testáveis e funcionais.

---

## Milestone 1: Fundação, Domínio Matemático e Serializadores (`@platform/shared`)
- **Incremento 1.1 (Primeiro Incremento):** Domínio de Engenharia de Features (`normalizeMinMax`, `oneHotWeighted`, cálculo de vetor de produto/perfil com fallback cold start) e cálculo geométrico do Agente Visual (`calculateBoundingBoxCenterX` + filtro de threshold $\ge 0.40$).
- **Incremento 1.2:** Serializadores `JSON Tabular` e `TOON` (Token Oriented Object Notation) + Construtor e Validador (Zod/Ajv) do Prompt Estruturado de 10 Blocos Anti-Alucinação.

## Milestone 2: Pipeline RAG Local & LLM Router (`@platform/backend` + Infra Docker)
- **Incremento 2.1:** Infraestrutura Docker (`docker-compose.yml` com Neo4j 5.x e Ollama CPU com provisionamento de modelos leves) e configuração validada do Backend Fastify.
- **Incremento 2.2:** Serviço de Chunking Semântico, Geração Local de Embeddings (`@huggingface/transformers`) e Repositório Vetorial Neo4j (`título`, `secção`, `minuto do vídeo`).
- **Incremento 2.3:** Orquestrador `LLMRouter` (`OllamaAdapter -> OpenRouterAdapter`) e endpoints REST/SSE do RAG (`/api/rag/ingest`, `/api/rag/query`).

## Milestone 3: Motor de Recomendação Neural em Tempo Real (`@platform/frontend`)
- **Incremento 3.1:** Web Worker de Recomendação (`tf.sequential` com camadas `128 -> 64 -> 32 -> 1`, `adam(0.01)`, `binaryCrossentropy`, perfil via `tf.stack`).
- **Incremento 3.2:** Painel de Recomendação no React integrado ao `tfvis` exibindo curvas de `loss` e `accuracy` em tempo real sem bloquear a UI.

## Milestone 4: Agente Visual YOLO & Vitrine Pixi.js/Vídeo (`@platform/frontend`)
- **Incremento 4.1:** Web Worker YOLO (`createImageBitmap`, pré-processamento em `tf.tidy` para $640 \times 640$, `executeAsync`, filtro $\ge 40\%$ e `centerX`).
- **Incremento 4.2:** Palco Híbrido `<canvas>` (Cena interativa Pixi.js + Stream de Vídeo/Câmera) com movimentação e ação automatizada do agente baseada no `centerX`.

## Milestone 5: Assistente Web 4.0 Multimodal & Integração E2E
- **Incremento 5.1:** Cadeia de Adaptadores Web AI (`GeminiNano -> TransformersJsWorker -> Ollama -> OpenRouter`) com suporte a texto, áudio, imagem (extração de cartão CNPJ e descrição de cenas) e tradução `PT <-> EN`.
- **Incremento 5.2:** Unificação do Fluxo Completo no Dashboard e suíte de testes E2E com Playwright.


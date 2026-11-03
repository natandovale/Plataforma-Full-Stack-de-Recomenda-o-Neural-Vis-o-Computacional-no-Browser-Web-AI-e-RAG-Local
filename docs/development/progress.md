# Project Progress

## Current Status

- **Status:** DEVELOPMENT
- **Last Update:** 2026-11-03
- **Current Milestone:** Milestone 2 — Pipeline RAG Local & LLM Router (`@platform/backend` + Infra Docker)

## Completed

- [x] Análise de requisitos, regras de negócio e identificação de ambiguidades.
- [x] Alinhamento arquitetural e definição da stack (Fastify + React/Vite + Neo4j + Ollama CPU + Fallbacks).
- [x] Governança técnica (`AGENTS.md`) e documentação complementar inicial.
- [x] Bootstrap do Monorepo (`packages/shared`, `packages/backend`, `packages/frontend`, `infrastructure/`).
- [x] Incremento 1.1: Engenharia de Features (`normalizeMinMax`, `oneHotWeighted`, perfil/cold start) e cálculo de `centerX` / threshold YOLO (`>= 0.40`).
- [x] Incremento 1.2: Serializadores `JSON Tabular` e `TOON` + Construtor/Validador (Zod + Ajv) do Prompt de 10 Blocos Anti-Alucinação.

## In Progress

- [ ] Incremento 2.1: Configuração validada do Backend Fastify, Chunking Semântico de PDFs/Transcrições e Repositório Vetorial Neo4j (aguardando alinhamento).

## Pending

- [ ] Incremento 2.2: Geração Local de Embeddings (`@huggingface/transformers`) e Orquestrador `LLMRouter` (`Ollama -> OpenRouter`).
- [ ] Incremento 2.3: Endpoints REST/SSE do Backend (`/api/health`, `/api/catalog`, `/api/rag/ingest`, `/api/rag/query`).
- [ ] Incremento 3.1 & 3.2: Web Worker `tf.sequential` e visualização `tfvis` no Browser.
- [ ] Incremento 4.1 & 4.2: Web Worker YOLO (`createImageBitmap` + `tf.tidy`) e palco Pixi.js/Vídeo com ação por `centerX`.
- [ ] Incremento 5.1 & 5.2: Assistente Multimodal Web 4.0 (Cadeia de Fallback + CNPJ/Cenas/Tradução) e Fluxo Integrado E2E.

## Next Steps

1. Alinhar e executar o Incremento 2.1 no `@platform/backend` via TDD.

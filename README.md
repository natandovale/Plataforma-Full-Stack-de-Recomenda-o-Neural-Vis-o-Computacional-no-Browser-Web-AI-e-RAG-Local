# Plataforma Full-Stack de Recomendação Neural, Visão Computacional no Browser (Web AI) e RAG Local com Neo4j

Plataforma integrada em **Node.js 22+ e TypeScript** que une quatro pilares de Inteligência Artificial num único fluxo interativo:

1. **Motor de Recomendação em Tempo Real no Browser:** Engenharia de features (`normalizeMinMax` e `oneHotWeighted`), perfil de utilizador com `tf.stack` (e fallback cold start), treino de rede neural `tf.sequential` (`128 -> 64 -> 32 -> 1`) em Web Worker e métricas ao vivo via `tfvis`.
2. **Agente Visual com YOLO & Pixi.js/Vídeo:** Captura de `<canvas>` via `createImageBitmap`, pré-processamento em `tf.tidy` ($640 \times 640$), inferência assíncrona em Web Worker (`classThreshold >= 40%`) e cálculo de `centerX` para disparo automatizado de ações.
3. **Assistente Web 4.0 Multimodal:** Processamento de texto, áudio e imagens (extração estruturada de cartão CNPJ, descrição de cenas) e tradução (`PT <-> EN`) com cadeia de resiliência: `Chrome Built-in AI (Gemini Nano) -> Transformer.js (Browser Worker) -> Ollama (Docker CPU) -> OpenRouter`.
4. **Pipeline RAG Local com Neo4j e Prompts JSON/TOON:** Chunking semântico de PDFs e transcrições, embeddings locais via `@huggingface/transformers`, indexação vetorial no Neo4j (`título`, `secção`, `minuto do vídeo`), prompt com os **10 blocos anti-alucinação** serializado em **JSON Tabular** ou **TOON** e roteamento `Ollama -> OpenRouter`.

---

## Como Executar o Projeto

### 1. Instalar dependências e rodar testes + typecheck
```bash
npm install
npm test
npm run typecheck
npm run build
```

### 2. Subir Infraestrutura Docker (Neo4j Vector Index + Ollama CPU com Auto-Pull)
```bash
docker compose -f infrastructure/docker-compose.yml up -d
```
> O container `platform-ollama-cpu` inicia em modo CPU e baixa automaticamente os modelos leves configurados (`qwen2.5:1.5b` para texto/RAG e `moondream` para visão).

### 3. Iniciar Backend (Fastify) e Frontend (React + Vite)
```bash
# Terminal 1 — Backend Fastify (http://localhost:3001)
npm run dev --workspace=@platform/backend

# Terminal 2 — Frontend Vite (http://localhost:5173)
npm run dev --workspace=@platform/frontend
```

---

## Documentação e Governança

- [AGENTS.md](file:///home/user/%C3%81rea%20de%20trabalho/temp/Projetos/Plataforma-Full-Stack-de-Recomenda-o-Neural-Vis-o-Computacional-no-Browser-Web-AI-e-RAG-Local/AGENTS.md) — Governança central e diretrizes de AI Pair Programming (XP + TDD).
- [Especificação de Requisitos](file:///home/user/%C3%81rea%20de%20trabalho/temp/Projetos/Plataforma-Full-Stack-de-Recomenda-o-Neural-Vis-o-Computacional-no-Browser-Web-AI-e-RAG-Local/docs/requirements/specification.md)
- [ADR-001: Cadeia de Fallback Web AI & Ollama CPU](file:///home/user/%C3%81rea%20de%20trabalho/temp/Projetos/Plataforma-Full-Stack-de-Recomenda-o-Neural-Vis-o-Computacional-no-Browser-Web-AI-e-RAG-Local/docs/architecture/decisions/ADR-001-webai-and-llm-fallback-chain.md)
- [Especificação Técnica (Features, YOLO, TOON e 10 Blocos)](file:///home/user/%C3%81rea%20de%20trabalho/temp/Projetos/Plataforma-Full-Stack-de-Recomenda-o-Neural-Vis-o-Computacional-no-Browser-Web-AI-e-RAG-Local/docs/technical/rag-prompt-and-feature-engineering.md)
- [Guia Ilustrado de Arquitetura, Fluxo de Tensores, TensorFlow.js e Busca por Cosseno](file:///home/user/%C3%81rea%20de%20trabalho/temp/Projetos/Plataforma-Full-Stack-de-Recomenda-o-Neural-Vis-o-Computacional-no-Browser-Web-AI-e-RAG-Local/docs/technical/architecture-tensors-and-ai-guide.md)
- [Plano de Desenvolvimento](file:///home/user/%C3%81rea%20de%20trabalho/temp/Projetos/Plataforma-Full-Stack-de-Recomenda-o-Neural-Vis-o-Computacional-no-Browser-Web-AI-e-RAG-Local/docs/development/development-plan.md)
- [Progresso do Projeto](file:///home/user/%C3%81rea%20de%20trabalho/temp/Projetos/Plataforma-Full-Stack-de-Recomenda-o-Neural-Vis-o-Computacional-no-Browser-Web-AI-e-RAG-Local/docs/development/progress.md)
- [Diário de Bordo (Development Log)](file:///home/user/%C3%81rea%20de%20trabalho/temp/Projetos/Plataforma-Full-Stack-de-Recomenda-o-Neural-Vis-o-Computacional-no-Browser-Web-AI-e-RAG-Local/docs/development/development-log.md)

# Plataforma Full-Stack de Recomendação Neural, Visão Computacional no Browser (Web AI) e RAG Local com Neo4j

Plataforma integrada em **Node.js 22+ e TypeScript** que une quatro pilares de Inteligência Artificial num único fluxo interativo:

1. **Motor de Recomendação em Tempo Real no Browser:** Engenharia de features (`normalizeMinMax` e `oneHotWeighted`), perfil de utilizador com `tf.stack` (e fallback cold start), treino de rede neural `tf.sequential` (`128 -> 64 -> 32 -> 1`) em Web Worker e métricas ao vivo via `tfvis`.
2. **Agente Visual com YOLO & Pixi.js/Vídeo:** Captura de `<canvas>` via `createImageBitmap`, pré-processamento em `tf.tidy` ($640 \times 640$), inferência assíncrona em Web Worker (`classThreshold >= 40%`) e cálculo de `centerX` para disparo automatizado de ações.
3. **Assistente Web 4.0 Multimodal:** Processamento de texto, áudio e imagens (extração estruturada de cartão CNPJ, descrição de cenas) e tradução (`PT <-> EN`) com cadeia de resiliência: `Chrome Built-in AI (Gemini Nano) -> Transformer.js (Browser Worker) -> Ollama (Docker CPU) -> OpenRouter`.
4. **Pipeline RAG Local com Neo4j e Prompts JSON/TOON:** Chunking semântico de PDFs e transcrições, embeddings locais via `@huggingface/transformers`, indexação vetorial no Neo4j (`título`, `secção`, `minuto do vídeo`), prompt com os **10 blocos anti-alucinação** serializado em **JSON Tabular** ou **TOON** e roteamento `Ollama -> OpenRouter`.

## Documentação e Governança

- [AGENTS.md](file:///home/user/%C3%81rea%20de%20trabalho/temp/Projetos/Plataforma-Full-Stack-de-Recomenda-o-Neural-Vis-o-Computacional-no-Browser-Web-AI-e-RAG-Local/AGENTS.md) — Governança central e diretrizes de AI Pair Programming (XP + TDD).
- [Especificação de Requisitos](file:///home/user/%C3%81rea%20de%20trabalho/temp/Projetos/Plataforma-Full-Stack-de-Recomenda-o-Neural-Vis-o-Computacional-no-Browser-Web-AI-e-RAG-Local/docs/requirements/specification.md)
- [ADR-001: Cadeia de Fallback Web AI & Ollama CPU](file:///home/user/%C3%81rea%20de%20trabalho/temp/Projetos/Plataforma-Full-Stack-de-Recomenda-o-Neural-Vis-o-Computacional-no-Browser-Web-AI-e-RAG-Local/docs/architecture/decisions/ADR-001-webai-and-llm-fallback-chain.md)
- [Especificação Técnica (Features, YOLO, TOON e 10 Blocos)](file:///home/user/%C3%81rea%20de%20trabalho/temp/Projetos/Plataforma-Full-Stack-de-Recomenda-o-Neural-Vis-o-Computacional-no-Browser-Web-AI-e-RAG-Local/docs/technical/rag-prompt-and-feature-engineering.md)
- [Plano de Desenvolvimento](file:///home/user/%C3%81rea%20de%20trabalho/temp/Projetos/Plataforma-Full-Stack-de-Recomenda-o-Neural-Vis-o-Computacional-no-Browser-Web-AI-e-RAG-Local/docs/development/development-plan.md)
- [Progresso do Projeto](file:///home/user/%C3%81rea%20de%20trabalho/temp/Projetos/Plataforma-Full-Stack-de-Recomenda-o-Neural-Vis-o-Computacional-no-Browser-Web-AI-e-RAG-Local/docs/development/progress.md)
- [Diário de Bordo (Development Log)](file:///home/user/%C3%81rea%20de%20trabalho/temp/Projetos/Plataforma-Full-Stack-de-Recomenda-o-Neural-Vis-o-Computacional-no-Browser-Web-AI-e-RAG-Local/docs/development/development-log.md)


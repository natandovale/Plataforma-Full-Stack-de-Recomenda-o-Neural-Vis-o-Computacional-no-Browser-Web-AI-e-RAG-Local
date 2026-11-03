# ADR-001: Cadeia de Fallback para Web AI (Gemini Nano) e Execução do Ollama em Container CPU

- **Data:** 2026-11-03
- **Status:** Aprovado

## 1. Contexto

O projeto exige:
1. Uso das APIs nativas do navegador (`window.ai` / `languageModel.create()` e Translation API) com Gemini Nano embarcado para processamento multimodal (texto, áudio, imagem/CNPJ) e tradução `PT <-> EN`.
2. Orquestração de LLMs no pipeline RAG entre Ollama (local) e OpenRouter (cloud).

Porém, o ambiente de desenvolvimento local não possui suporte de hardware habilitado para o Gemini Nano nativo do Chrome e não dispõe de GPU dedicada para o container Docker do Ollama.

## 2. Problema

Como garantir que todas as funcionalidades do Assistente Multimodal Web 4.0 e do Pipeline RAG funcionem de ponta a ponta na máquina do desenvolvedor sem descaracterizar os requisitos originais da arquitetura?

## 3. Decisão Tomada

1. **Padrão Chain of Responsibility / Adapter para o Assistente Multimodal (`WebAIProvider`):**
   Implementar uma cadeia de execução ordenada com fallback transparente mantendo a mesma interface (`createSession({ temperature, topK })`, `promptStreaming()`, `extractStructuredData()`, `translate()`):
   - **Nível 1:** `GeminiNanoAdapter` (verifica disponibilidade de `self.ai?.languageModel` / `window.ai` e API de tradução nativa).
   - **Nível 2:** `TransformersJsWorkerAdapter` (executa modelos ONNX compactos via `@huggingface/transformers` em um Web Worker 100% no browser e offline).
   - **Nível 3:** `OllamaBridgeAdapter` (delega via SSE para o container Ollama local rodando em CPU).
   - **Nível 4:** `OpenRouterBridgeAdapter` (fallback final em nuvem via OpenRouter).

2. **Container Docker do Ollama Otimizado para CPU com Auto-Provisionamento:**
   - Configurar o serviço `ollama` no `docker-compose.yml` para execução em CPU com volume persistente e script `entrypoint.sh` que verifica e baixa automaticamente modelos leves (`qwen2.5:1.5b` para texto/RAG e `moondream` para visão) na inicialização.

## 4. Alternativas Consideradas

- **Usar apenas Mocks quando `window.ai` não estiver disponível:** Rejeitado, pois impediria o uso real de IA multimodal e tradução no projeto.
- **Usar modelos de 7B/8B parâmetros no Ollama em CPU:** Rejeitado, pois causaria alta latência (>45s por token/resposta) e consumo excessivo de RAM em máquinas sem GPU.

## 5. Consequências

- **Positivas:** O código continua 100% compatível com o Chrome Built-in AI (`window.ai`) onde suportado, funciona offline via Transformer.js e possui resiliência completa via Ollama CPU e OpenRouter.
- **Negativas / Trade-offs:** Necessidade de implementar os adaptadores da cadeia de fallback e gerenciar o carregamento sob demanda dos modelos do Transformer.js no worker.


# Especificação de Requisitos — Plataforma Full-Stack de IA Híbrida

## 1. Visão Geral e Fluxo Único Integrado

A plataforma integra quatro capacidades de Inteligência Artificial em uma jornada única de **Catálogo e E-Commerce Inteligente**:

1. **Entrada e Assistente Multimodal (Web AI 4.0):** O utilizador ou operador pode extrair informações estruturadas de documentos (ex.: cartão CNPJ), descrever imagens de produtos/cenas, interagir por áudio/texto e traduzir conteúdos (`PT <-> EN`).
2. **Recomendação Neural em Tempo Real (TensorFlow.js):** Com base no perfil do utilizador (histórico de compras empilhado via `tf.stack` ou fallback de cold start pela idade normalizada) e nas features dos produtos (`oneHotWeighted`), um Web Worker treina uma rede `tf.sequential` em segundo plano e atualiza gráficos de `loss` e `accuracy` via `tfvis`.
3. **Vitrine Visual Interativa & Agente YOLO (Pixi.js + Vídeo):** Os itens e cenas são exibidos num `<canvas>` (suportando simulação interativa em Pixi.js e stream de vídeo/câmera). O Agente Visual captura frames via `createImageBitmap`, executa o modelo YOLO em Web Worker (`executeAsync`), filtra objetos com `classThreshold >= 0.40`, calcula o centro horizontal (`centerX`) e move o agente/cursor automaticamente para inspecionar o item.
4. **Consulta Semântica em Manuais e Vídeos (RAG Local Neo4j):** Ao consultar detalhes técnicos, manuais em PDF ou transcrições de vídeos sobre os produtos, o backend gera embeddings locais com `@huggingface/transformers`, realiza busca vetorial no Neo4j enriquecida com `título`, `secção` e `minuto do vídeo`, injeta os dados num prompt de **10 blocos anti-alucinação** (serializado em **JSON Tabular** ou **TOON**) e orquestra a resposta via **Ollama (Docker CPU)** com fallback para **OpenRouter**.

---

## 2. Regras de Negócio (RN)

| ID | Regra | Fórmula / Detalhamento |
|---|---|---|
| **RN01** | Normalização Contínua | Variáveis contínuas (`idade` e `preço`) são normalizadas por $(\text{valor} - \min) / (\max - \min)$. Se $\max = \min$, retorna $0$. |
| **RN02** | One-Hot Encoding Ponderado (`oneHotWeighted`) | Pesos aprovados por ordem de importância: `categoria` = $0.40$, `cor` = $0.25$, `preço` = $0.20$, `idade média dos compradores` = $0.15$. |
| **RN03** | Perfil do Utilizador e Cold Start | Utilizador com histórico: média dos vetores dos produtos comprados via `tf.stack`. Novo utilizador (sem histórico): fallback utilizando a idade normalizada. |
| **RN04** | Arquitetura da Rede Neural | `tf.sequential`: Dense(`128`, `relu`) -> Dense(`64`, `relu`) -> Dense(`32`, `relu`) -> Dense(`1`, `sigmoid`), otimizador `adam(0.01)` e loss `binaryCrossentropy`. |
| **RN05** | Pré-processamento e Ação YOLO | Em `tf.tidy`: `fromPixels` -> `resizeBilinear([640, 640])` -> `/ 255` -> `expandDims(0)`. Filtra `score >= 0.40` e calcula $\text{centerX} = x_1 + (x_2 - x_1)/2$ para disparo de ação. |
| **RN06** | Cadeia de Fallback Web AI | Ordem estrita: `1. Chrome Built-in AI (Gemini Nano)` -> `2. Transformer.js (Browser Worker)` -> `3. Ollama (Docker CPU)` -> `4. OpenRouter`. |
| **RN07** | Metadados Obrigatórios do RAG | Todo chunk persistido no índice vetorial do Neo4j deve conter: `title` (título), `section` (secção) e `videoMinute` (minuto do vídeo). |
| **RN08** | Prompt de 10 Blocos Anti-Alucinação | O prompt RAG deve conter obrigatoriamente: `contexto`, `tom`, `fonte da verdade`, `contrato operacional`, `exemplos`, `histórico`, `pedido`, `raciocínio`, `formato` e `restrições`. |
| **RN09** | Serialização Econômica | O bloco `fonte da verdade` deve suportar serialização em **JSON Tabular** ou **TOON (Token Oriented Object Notation)**. |
| **RN10** | Roteamento de LLMs no Backend | Execução primária no container **Ollama (CPU)** com fallback automático para **OpenRouter** em caso de erro ou indisponibilidade. |

---

## 3. Requisitos Funcionais (RF)

- **RF01:** Calcular vetores de features de produtos e perfis de utilizadores aplicando normalização min-max e `oneHotWeighted`.
- **RF02:** Executar o treinamento da rede `tf.sequential` dentro de um Web Worker e transmitir métricas de época para renderização com `tfvis`.
- **RF03:** Renderizar `<canvas>` híbrido (cena interativa Pixi.js e modo vídeo/câmera) e capturar frames via `createImageBitmap`.
- **RF04:** Executar inferência assíncrona do YOLO (`executeAsync`) em Web Worker, filtrar detecções ($\ge 40\%$), calcular `centerX` e acionar movimentação/seleção automatizada.
- **RF05:** Processar texto, áudio e imagens (incluindo extração estruturada de cartão CNPJ e descrição de cenas) com controle de `temperature`, `topK` e streaming através da cadeia de adaptadores Web AI.
- **RF06:** Traduzir textos entre Português e Inglês (`PT <-> EN`) utilizando a API nativa de tradução com fallback na cadeia de provedores.
- **RF07:** Ingerir documentos PDF e transcrições, realizar chunking semântico e gerar embeddings localmente em Node.js com `@huggingface/transformers` (`Xenova/all-MiniLM-L6-v2`).
- **RF08:** Indexar e buscar chunks por similaridade vetorial no Neo4j retornando texto, score e metadados (`título`, `secção`, `minuto do vídeo`).
- **RF09:** Serializar contextos recuperados em JSON Tabular ou TOON, validar o contrato do prompt de 10 blocos com Zod/Ajv e consultar o LLM Router (`Ollama -> OpenRouter`).

---

## 4. Requisitos Não Funcionais (RNF)

- **RNF01 (UI Non-blocking):** Treinamento neural e inferência de visão computacional devem ocorrer exclusivamente em Web Workers.
- **RNF02 (Gestão de Memória de Tensores):** Uso obrigatório de `tf.tidy` e descarte explícito de tensores e `ImageBitmap` para evitar vazamento de memória WebGL/WASM.
- **RNF03 (Execução em CPU no Docker):** O container do Ollama deve funcionar em CPU pura com modelos compactos pré-provisionados (`qwen2.5:1.5b` e `moondream`).
- **RNF04 (Tipagem e Validação):** TypeScript em modo `strict` em todos os pacotes e validação de schemas nas fronteiras com Zod e Ajv.
- **RNF05 (Testabilidade TDD):** Cobertura das regras matemáticas, serializadores, construtores de prompt e adaptadores de fallback via testes automatizados.


import { describe, expect, it, vi } from 'vitest';
import {
  DeterministicHashEmbedder,
  TransformersJsLocalEmbedder
} from '../../packages/backend/src/modules/rag/adapters/local-embedder.js';
import {
  LLMRouter,
  OllamaAdapter,
  OpenRouterAdapter,
  type LLMProvider
} from '../../packages/backend/src/modules/llm-router/services/llm-router.js';
import { InMemoryVectorRepository } from '../../packages/backend/src/modules/rag/adapters/neo4j-vector-repository.js';
import { RagService } from '../../packages/backend/src/modules/rag/services/rag-service.js';

describe('Increment 2.2 — Local Embeddings, LLMRouter (Ollama -> OpenRouter) & RagService', () => {
  describe('RN07: Local Embeddings (384 dimensions)', () => {
    it('generates normalized 384-dimensional vectors in DeterministicHashEmbedder', async () => {
      const embedder = new DeterministicHashEmbedder(384);
      const vec1 = await embedder.embedText('Camera Pro 4K autofoco ocular');
      const vec2 = await embedder.embedText('Camera Pro 4K autofoco ocular');

      expect(vec1).toHaveLength(384);
      expect(vec1).toEqual(vec2);

      const norm = Math.sqrt(vec1.reduce((acc, v) => acc + v * v, 0));
      expect(norm).toBeCloseTo(1, 4);
    });

    it('invokes feature-extraction pipeline with mean pooling and normalization in TransformersJsLocalEmbedder', async () => {
      const fakeExtractor = vi.fn().mockResolvedValue({
        data: new Float32Array(384).fill(0.05)
      });
      const embedder = new TransformersJsLocalEmbedder('Xenova/all-MiniLM-L6-v2', async () => fakeExtractor);

      const vector = await embedder.embedText('Teste de embedding local');
      expect(vector).toHaveLength(384);
      expect(fakeExtractor).toHaveBeenCalledWith('Teste de embedding local', {
        pooling: 'mean',
        normalize: true
      });
    });
  });

  describe('RN08 & Section 7.3: LLMRouter Chain (1. Ollama CPU -> 2. OpenRouter Fallback)', () => {
    it('uses primary Ollama provider when available without calling OpenRouter fallback', async () => {
      const ollamaProvider: LLMProvider = {
        name: 'ollama',
        generate: vi.fn().mockResolvedValue({
          text: 'Resposta gerada pelo Ollama CPU local [Manual Camera Pro 4K | Autofoco | 04:15]',
          model: 'qwen2.5:1.5b'
        })
      };
      const openRouterProvider: LLMProvider = {
        name: 'openrouter',
        generate: vi.fn()
      };

      const router = new LLMRouter([ollamaProvider, openRouterProvider]);
      const response = await router.generate({ prompt: 'Qual o autofoco?' });

      expect(response.provider).toBe('ollama');
      expect(response.fallbackTriggered).toBe(false);
      expect(response.fallbackErrors).toEqual([]);
      expect(openRouterProvider.generate).not.toHaveBeenCalled();
    });

    it('falls back to OpenRouter and records primary failure reason when Ollama fails', async () => {
      const ollamaProvider: LLMProvider = {
        name: 'ollama',
        generate: vi.fn().mockRejectedValue(new Error('connect ECONNREFUSED 127.0.0.1:11434'))
      };
      const openRouterProvider: LLMProvider = {
        name: 'openrouter',
        generate: vi.fn().mockResolvedValue({
          text: 'Resposta via OpenRouter Fallback [Manual Camera Pro 4K | Autofoco | 04:15]',
          model: 'google/gemini-2.0-flash-exp:free'
        })
      };

      const router = new LLMRouter([ollamaProvider, openRouterProvider]);
      const response = await router.generate({ prompt: 'Qual o autofoco?' });

      expect(response.provider).toBe('openrouter');
      expect(response.fallbackTriggered).toBe(true);
      expect(response.fallbackErrors).toHaveLength(1);
      expect(response.fallbackErrors[0]).toContain('ollama: connect ECONNREFUSED 127.0.0.1:11434');
    });

    it('calls Ollama HTTP API and OpenRouter HTTP API in concrete adapters', async () => {
      const fetchMock = vi
        .fn()
        .mockResolvedValueOnce({
          ok: true,
          json: async () => ({ response: 'Ollama HTTP OK' })
        })
        .mockResolvedValueOnce({
          ok: true,
          json: async () => ({
            choices: [{ message: { content: 'OpenRouter HTTP OK' } }]
          })
        });

      const ollama = new OllamaAdapter({
        baseUrl: 'http://localhost:11434',
        defaultTextModel: 'qwen2.5:1.5b',
        defaultVisionModel: 'moondream',
        fetchFn: fetchMock as never
      });

      const openRouter = new OpenRouterAdapter({
        apiKey: 'test-key',
        defaultModel: 'google/gemini-2.0-flash-exp:free',
        fetchFn: fetchMock as never
      });

      const res1 = await ollama.generate({ prompt: 'Ping Ollama' });
      expect(res1.text).toBe('Ollama HTTP OK');

      const res2 = await openRouter.generate({ prompt: 'Ping OpenRouter' });
      expect(res2.text).toBe('OpenRouter HTTP OK');
    });
  });

  describe('RagService End-to-End Pipeline (Ingest -> Vector Search -> 10-Block Prompt TOON/JSON Tabular -> LLMRouter)', () => {
    it('ingests documents with metadata, retrieves similar chunks, validates 10-block prompt and returns LLM answer with token metrics', async () => {
      const vectorRepo = new InMemoryVectorRepository();
      const embedder = new DeterministicHashEmbedder(384);
      const fakeProvider: LLMProvider = {
        name: 'ollama',
        generate: vi.fn().mockResolvedValue({
          text: 'O autofoco opera em 60fps com detecção ocular [Manual Camera Pro 4K | Autofoco e Lentes | 04:15].',
          model: 'qwen2.5:1.5b'
        })
      };
      const llmRouter = new LLMRouter([fakeProvider]);

      const ragService = new RagService(vectorRepo, embedder, llmRouter);

      const ingestSummary = await ragService.ingestDocument({
        documentId: 'doc-cam-4k',
        title: 'Manual Camera Pro 4K',
        content: [
          '## [04:15] Autofoco e Lentes',
          'O autofoco híbrido opera em 60fps com detecção ocular em tempo real.',
          '## [09:20] Bateria e Energia',
          'A bateria NP-FZ100 garante gravação contínua de 140 minutos em 4K.'
        ].join('\n')
      });

      expect(ingestSummary.chunksIndexed).toBe(2);

      const queryResult = await ragService.query({
        question: 'Como funciona o autofoco ocular em 60fps?',
        serializationFormat: 'TOON',
        topK: 2
      });

      expect(queryResult.answer).toContain('[Manual Camera Pro 4K | Autofoco e Lentes | 04:15]');
      expect(queryResult.provider).toBe('ollama');
      expect(queryResult.chunks).toHaveLength(2);
      expect(queryResult.prompt.serializationFormat).toBe('TOON');
      expect(queryResult.prompt.blocks.fonteDaVerdade).toContain('@schema[id|title|section|videoMinute|score|text]');
      expect(queryResult.tokenEconomy.toonChars).toBeLessThan(queryResult.tokenEconomy.standardJsonChars);
    });
  });
});


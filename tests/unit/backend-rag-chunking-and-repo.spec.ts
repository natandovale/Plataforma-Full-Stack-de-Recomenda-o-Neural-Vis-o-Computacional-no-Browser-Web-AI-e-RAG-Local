import { describe, expect, it, vi } from 'vitest';
import { parseBackendEnv } from '../../packages/backend/src/config/env.js';
import {
  chunkDocumentSemantically,
  type RawDocumentInput
} from '../../packages/backend/src/modules/rag/services/semantic-chunker.js';
import {
  InMemoryVectorRepository,
  Neo4jVectorRepository,
  cosineSimilarity
} from '../../packages/backend/src/modules/rag/adapters/neo4j-vector-repository.js';

describe('Increment 2.1 — Backend Env Validation, Semantic Chunking & Neo4j Vector Repository', () => {
  describe('Environment Configuration (Zod)', () => {
    it('applies approved defaults for PORT, NEO4J, OLLAMA CPU models and EMBEDDING_MODEL', () => {
      const env = parseBackendEnv({
        NODE_ENV: 'test',
        NEO4J_PASSWORD: 'test_password'
      });

      expect(env.PORT).toBe(3001);
      expect(env.NEO4J_URI).toBe('bolt://localhost:7687');
      expect(env.NEO4J_USER).toBe('neo4j');
      expect(env.OLLAMA_TEXT_MODEL).toBe('qwen2.5:1.5b');
      expect(env.OLLAMA_VISION_MODEL).toBe('moondream');
      expect(env.EMBEDDING_MODEL).toBe('Xenova/all-MiniLM-L6-v2');
    });

    it('rejects invalid PORT values', () => {
      expect(() =>
        parseBackendEnv({
          PORT: 'invalid-port'
        })
      ).toThrow();
    });
  });

  describe('RN07: Semantic Chunker with Mandatory Metadata (title, section, videoMinute)', () => {
    it('splits structured document/transcription into semantic chunks preserving title, section and videoMinute', () => {
      const doc: RawDocumentInput = {
        documentId: 'doc-camera-pro',
        title: 'Manual Técnico Camera Pro 4K',
        content: [
          '## [02:10] Sensor e Resolução',
          'O sensor CMOS full-frame de 45MP permite captura em 4K a 120fps sem crop.',
          'Além disso, possui faixa dinâmica de 15 stops para cenas de alto contraste.',
          '',
          '## [06:45] Conectividade e Streaming',
          'A porta USB-C 3.2 suporta transmissão UVC/UAC direta em 4K 60fps e carregamento PD.'
        ].join('\n'),
        maxChunkChars: 160
      };

      const chunks = chunkDocumentSemantically(doc);

      expect(chunks.length).toBeGreaterThanOrEqual(2);
      expect(chunks[0]?.title).toBe('Manual Técnico Camera Pro 4K');
      expect(chunks[0]?.section).toBe('Sensor e Resolução');
      expect(chunks[0]?.videoMinute).toBe('02:10');
      expect(chunks[0]?.text).toContain('sensor CMOS full-frame');

      const streamingChunk = chunks.find((c) => c.section === 'Conectividade e Streaming');
      expect(streamingChunk).toBeDefined();
      expect(streamingChunk?.videoMinute).toBe('06:45');
      expect(streamingChunk?.text).toContain('USB-C 3.2');
    });

    it('assigns default section and videoMinute (00:00) when headings are absent', () => {
      const chunks = chunkDocumentSemantically({
        documentId: 'doc-plain',
        title: 'Guia Rápido Notebook AI',
        content: 'Bateria de longa duração com 18 horas de autonomia e NPU dedicada.'
      });

      expect(chunks).toHaveLength(1);
      expect(chunks[0]?.title).toBe('Guia Rápido Notebook AI');
      expect(chunks[0]?.section).toBe('Geral');
      expect(chunks[0]?.videoMinute).toBe('00:00');
    });
  });

  describe('RN07: Vector Repository (InMemory & Neo4j Cypher Vector Index Adapter)', () => {
    it('computes cosine similarity and retrieves topK chunks sorted by similarity score in InMemoryVectorRepository', async () => {
      const repo = new InMemoryVectorRepository();
      await repo.ensureVectorIndex();

      await repo.upsertChunks([
        {
          id: 'c1',
          documentId: 'doc-1',
          title: 'Manual Camera Pro 4K',
          section: 'Autofoco',
          videoMinute: '04:15',
          text: 'Autofoco ocular em tempo real.',
          embedding: [1, 0, 0]
        },
        {
          id: 'c2',
          documentId: 'doc-1',
          title: 'Manual Camera Pro 4K',
          section: 'Áudio',
          videoMinute: '09:30',
          text: 'Microfone direcional estéreo.',
          embedding: [0, 1, 0]
        }
      ]);

      expect(cosineSimilarity([1, 0, 0], [1, 0, 0])).toBeCloseTo(1, 5);
      expect(cosineSimilarity([1, 0, 0], [0, 1, 0])).toBeCloseTo(0, 5);

      const results = await repo.searchSimilar([0.9, 0.1, 0], 1);
      expect(results).toHaveLength(1);
      expect(results[0]?.id).toBe('c1');
      expect(results[0]?.title).toBe('Manual Camera Pro 4K');
      expect(results[0]?.section).toBe('Autofoco');
      expect(results[0]?.videoMinute).toBe('04:15');
      expect(results[0]?.score).toBeGreaterThan(0.9);
    });

    it('executes Neo4j vector index creation and Cypher similarity query in Neo4jVectorRepository', async () => {
      const runMock = vi.fn().mockResolvedValue({
        records: [
          {
            get: (key: string) => {
              const map: Record<string, unknown> = {
                id: 'c-neo-1',
                title: 'Review Drone 8K',
                section: 'Sensores Anti-Colisão',
                videoMinute: '03:20',
                text: 'Sensores omnidirecionais ativos.',
                score: 0.91
              };
              return map[key];
            }
          }
        ]
      });
      const closeSessionMock = vi.fn().mockResolvedValue(undefined);
      const fakeDriver = {
        session: () => ({
          run: runMock,
          close: closeSessionMock
        }),
        close: vi.fn().mockResolvedValue(undefined)
      };

      const neo4jRepo = new Neo4jVectorRepository(fakeDriver as never, {
        indexName: 'rag_chunk_vector_idx',
        dimensions: 384
      });

      await neo4jRepo.ensureVectorIndex();
      expect(runMock).toHaveBeenCalledWith(
        expect.stringContaining('CREATE VECTOR INDEX rag_chunk_vector_idx IF NOT EXISTS'),
        expect.anything()
      );

      const results = await neo4jRepo.searchSimilar([0.1, 0.2, 0.3], 3);
      expect(runMock).toHaveBeenCalledWith(
        expect.stringContaining('CALL db.index.vector.queryNodes'),
        expect.objectContaining({
          indexName: 'rag_chunk_vector_idx',
          topK: 3
        })
      );
      expect(results).toEqual([
        {
          id: 'c-neo-1',
          title: 'Review Drone 8K',
          section: 'Sensores Anti-Colisão',
          videoMinute: '03:20',
          text: 'Sensores omnidirecionais ativos.',
          score: 0.91
        }
      ]);
      expect(closeSessionMock).toHaveBeenCalled();
    });
  });
});


import type { Driver } from 'neo4j-driver';
import type { RagChunkWithMetadata } from '@platform/shared';
import type { SemanticChunk } from '../services/semantic-chunker.js';

export interface IndexedVectorChunk extends SemanticChunk {
  readonly embedding: readonly number[];
}

export interface VectorRepository {
  ensureVectorIndex(): Promise<void>;
  upsertChunks(chunks: readonly IndexedVectorChunk[]): Promise<void>;
  searchSimilar(queryEmbedding: readonly number[], topK?: number): Promise<RagChunkWithMetadata[]>;
}

export function cosineSimilarity(vecA: readonly number[], vecB: readonly number[]): number {
  const length = Math.min(vecA.length, vecB.length);
  if (length === 0) return 0;

  let dot = 0;
  let normA = 0;
  let normB = 0;

  for (let i = 0; i < length; i++) {
    const a = vecA[i] ?? 0;
    const b = vecB[i] ?? 0;
    dot += a * b;
    normA += a * a;
    normB += b * b;
  }

  const denominator = Math.sqrt(normA) * Math.sqrt(normB);
  return denominator === 0 ? 0 : dot / denominator;
}

/**
 * In-memory implementation of VectorRepository for fast unit/integration tests
 * and resilient local operation when Neo4j container is offline.
 */
export class InMemoryVectorRepository implements VectorRepository {
  private readonly store = new Map<string, IndexedVectorChunk>();

  async ensureVectorIndex(): Promise<void> {
    // No-op for in-memory store
  }

  async upsertChunks(chunks: readonly IndexedVectorChunk[]): Promise<void> {
    for (const chunk of chunks) {
      this.store.set(chunk.id, chunk);
    }
  }

  async searchSimilar(
    queryEmbedding: readonly number[],
    topK = 4
  ): Promise<RagChunkWithMetadata[]> {
    const scored: RagChunkWithMetadata[] = [];
    for (const chunk of this.store.values()) {
      const score = cosineSimilarity(queryEmbedding, chunk.embedding);
      scored.push({
        id: chunk.id,
        title: chunk.title,
        section: chunk.section,
        videoMinute: chunk.videoMinute,
        score,
        text: chunk.text
      });
    }

    return scored.sort((a, b) => b.score - a.score).slice(0, topK);
  }
}

export interface Neo4jVectorRepoOptions {
  readonly indexName?: string;
  readonly dimensions?: number;
}

/**
 * RN07: Official Neo4j 5.x Vector Index repository storing (:Document)-[:HAS_CHUNK]->(:Chunk)
 * with mandatory metadata (title, section, videoMinute) and cosine similarity search.
 */
export class Neo4jVectorRepository implements VectorRepository {
  private readonly indexName: string;
  private readonly dimensions: number;

  constructor(
    private readonly driver: Driver,
    options: Neo4jVectorRepoOptions = {}
  ) {
    this.indexName = options.indexName ?? 'rag_chunk_vector_idx';
    this.dimensions = options.dimensions ?? 384;
  }

  async ensureVectorIndex(): Promise<void> {
    const session = this.driver.session();
    try {
      const cypher = `
        CREATE VECTOR INDEX ${this.indexName} IF NOT EXISTS
        FOR (c:Chunk) ON (c.embedding)
        OPTIONS {
          indexConfig: {
            \`vector.dimensions\`: $dimensions,
            \`vector.similarity_function\`: 'cosine'
          }
        }
      `;
      await session.run(cypher, { dimensions: this.dimensions });
    } finally {
      await session.close();
    }
  }

  async upsertChunks(chunks: readonly IndexedVectorChunk[]): Promise<void> {
    if (chunks.length === 0) return;

    const session = this.driver.session();
    try {
      const cypher = `
        UNWIND $chunks AS item
        MERGE (d:Document { id: item.documentId })
        SET d.title = item.title
        MERGE (c:Chunk { id: item.id })
        SET c.title = item.title,
            c.section = item.section,
            c.videoMinute = item.videoMinute,
            c.text = item.text,
            c.embedding = item.embedding
        MERGE (d)-[:HAS_CHUNK]->(c)
      `;
      await session.run(cypher, {
        chunks: chunks.map((c) => ({
          ...c,
          embedding: [...c.embedding]
        }))
      });
    } finally {
      await session.close();
    }
  }

  async searchSimilar(
    queryEmbedding: readonly number[],
    topK = 4
  ): Promise<RagChunkWithMetadata[]> {
    const session = this.driver.session();
    try {
      const cypher = `
        CALL db.index.vector.queryNodes($indexName, $topK, $queryEmbedding)
        YIELD node, score
        RETURN node.id AS id,
               node.title AS title,
               node.section AS section,
               node.videoMinute AS videoMinute,
               node.text AS text,
               score
        ORDER BY score DESC
      `;
      const result = await session.run(cypher, {
        indexName: this.indexName,
        topK,
        queryEmbedding: [...queryEmbedding]
      });

      return result.records.map((record) => ({
        id: String(record.get('id')),
        title: String(record.get('title')),
        section: String(record.get('section')),
        videoMinute: String(record.get('videoMinute')),
        text: String(record.get('text')),
        score: Number(record.get('score'))
      }));
    } finally {
      await session.close();
    }
  }
}


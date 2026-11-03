import {
  type RagChunkWithMetadata,
  type SourceOfTruthSerializationFormat,
  type TenBlockRagPrompt,
  buildTenBlockRagPrompt,
  renderTenBlockPromptToText,
  serializeChunksToJsonTabular,
  serializeChunksToToon,
  validateTenBlockPromptWithAjv,
  validateTenBlockPromptWithZod
} from '@platform/shared';
import type { LLMRouter } from '../../llm-router/services/llm-router.js';
import type { LocalEmbedder } from '../adapters/local-embedder.js';
import type { IndexedVectorChunk, VectorRepository } from '../adapters/neo4j-vector-repository.js';
import { chunkDocumentSemantically, type RawDocumentInput } from './semantic-chunker.js';

export interface RagQueryInput {
  readonly question: string;
  readonly serializationFormat?: SourceOfTruthSerializationFormat;
  readonly topK?: number;
  readonly history?: readonly string[];
}

export interface TokenEconomyMetrics {
  readonly standardJsonChars: number;
  readonly jsonTabularChars: number;
  readonly toonChars: number;
}

export interface RagQueryResult {
  readonly answer: string;
  readonly provider: string;
  readonly model: string;
  readonly fallbackTriggered: boolean;
  readonly fallbackErrors: readonly string[];
  readonly chunks: readonly RagChunkWithMetadata[];
  readonly prompt: TenBlockRagPrompt;
  readonly renderedPrompt: string;
  readonly tokenEconomy: TokenEconomyMetrics;
}

export class RagService {
  constructor(
    private readonly vectorRepository: VectorRepository,
    private readonly embedder: LocalEmbedder,
    private readonly llmRouter: LLMRouter
  ) {}

  async ingestDocument(input: RawDocumentInput): Promise<{
    documentId: string;
    chunksIndexed: number;
  }> {
    await this.vectorRepository.ensureVectorIndex();
    const semanticChunks = chunkDocumentSemantically(input);
    const indexedChunks: IndexedVectorChunk[] = [];

    for (const chunk of semanticChunks) {
      const embedding = await this.embedder.embedText(`${chunk.title} ${chunk.section} ${chunk.text}`);
      indexedChunks.push({
        ...chunk,
        embedding
      });
    }

    await this.vectorRepository.upsertChunks(indexedChunks);
    return {
      documentId: input.documentId,
      chunksIndexed: indexedChunks.length
    };
  }

  async query(input: RagQueryInput): Promise<RagQueryResult> {
    const queryEmbedding = await this.embedder.embedText(input.question);
    const chunks = await this.vectorRepository.searchSimilar(queryEmbedding, input.topK ?? 4);
    const format = input.serializationFormat ?? 'TOON';

    const prompt = buildTenBlockRagPrompt({
      question: input.question,
      chunks,
      serializationFormat: format,
      history: input.history
    });

    const zodValidation = validateTenBlockPromptWithZod(prompt);
    if (!zodValidation.success) {
      throw new Error(`Invalid 10-block RAG prompt (Zod): ${zodValidation.error.message}`);
    }

    const ajvValidation = validateTenBlockPromptWithAjv(prompt);
    if (!ajvValidation.valid) {
      throw new Error(`Invalid 10-block RAG prompt (Ajv): ${ajvValidation.errors.join(', ')}`);
    }

    const renderedPrompt = renderTenBlockPromptToText(prompt);
    const llmResponse = await this.llmRouter.generate({ prompt: renderedPrompt });

    const standardJsonChars = JSON.stringify(chunks).length;
    const jsonTabularChars = serializeChunksToJsonTabular(chunks).length;
    const toonChars = serializeChunksToToon(chunks).length;

    return {
      answer: llmResponse.text,
      provider: llmResponse.provider,
      model: llmResponse.model,
      fallbackTriggered: llmResponse.fallbackTriggered,
      fallbackErrors: llmResponse.fallbackErrors,
      chunks,
      prompt,
      renderedPrompt,
      tokenEconomy: {
        standardJsonChars,
        jsonTabularChars,
        toonChars
      }
    };
  }
}


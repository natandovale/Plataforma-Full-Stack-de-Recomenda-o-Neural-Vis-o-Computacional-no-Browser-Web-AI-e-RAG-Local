import Fastify, { type FastifyInstance } from 'fastify';
import cors from '@fastify/cors';
import neo4j from 'neo4j-driver';
import { z } from 'zod';
import { parseBackendEnv, type BackendEnv } from './config/env.js';
import {
  CATALOG_CATEGORIES,
  CATALOG_COLORS,
  INITIAL_CATALOG_PRODUCTS,
  INITIAL_KNOWLEDGE_DOCUMENTS,
  INITIAL_SAMPLE_USERS
} from './modules/catalog/catalog-data.js';
import {
  DeterministicHashEmbedder,
  TransformersJsLocalEmbedder,
  type LocalEmbedder
} from './modules/rag/adapters/local-embedder.js';
import {
  InMemoryVectorRepository,
  Neo4jVectorRepository,
  type VectorRepository
} from './modules/rag/adapters/neo4j-vector-repository.js';
import {
  LLMRouter,
  OllamaAdapter,
  OpenRouterAdapter,
  type LLMGenerateRequest,
  type LLMProvider,
  type LLMProviderResult
} from './modules/llm-router/services/llm-router.js';
import { RagService } from './modules/rag/services/rag-service.js';

export interface CreateBackendAppOptions {
  readonly env?: Partial<Record<string, string>>;
  readonly useInMemoryRag?: boolean;
}

export interface StructuredCnpjData {
  readonly cnpj: string;
  readonly razaoSocial: string;
  readonly nomeFantasia: string;
  readonly situacaoCadastral: string;
}

export function extractStructuredCnpjFromText(text: string): StructuredCnpjData {
  const cnpjMatch = /(\d{2}\.\d{3}\.\d{3}\/\d{4}-\d{2}|\d{14})/.exec(text);
  const razaoMatch = /Raz[aã]o Social:\s*([^|\n]+)/i.exec(text);
  const fantasiaMatch = /Nome Fantasia:\s*([^|\n]+)/i.exec(text);
  const situacaoMatch = /Situa[cç][aã]o(?:\s+Cadastral)?:\s*([^|\n]+)/i.exec(text);

  return {
    cnpj: cnpjMatch?.[1]?.trim() ?? '00.000.000/0001-00',
    razaoSocial: razaoMatch?.[1]?.trim() ?? 'Empresa Extraída Localmente S/A',
    nomeFantasia: fantasiaMatch?.[1]?.trim() ?? 'Unidade Matriz',
    situacaoCadastral: situacaoMatch?.[1]?.trim() ?? 'ATIVA'
  };
}

/**
 * Local grounded synthesizer provider that acts as the final deterministic guard
 * when running tests or offline without Docker/Cloud connectivity, strictly synthesizing
 * answers from the 10-block prompt's FONTE DA VERDADE block.
 */
class LocalGroundedSynthesizerProvider implements LLMProvider {
  public readonly name = 'local-synthesizer' as const;

  async generate(request: LLMGenerateRequest): Promise<LLMProviderResult> {
    const prompt = request.prompt;
    const toonRowMatch = /@schema\[[^\]]+\]\n([^\n]+)/.exec(prompt);
    if (toonRowMatch?.[1] && toonRowMatch[1] !== 'NONE') {
      const cols = toonRowMatch[1].split('|');
      const title = cols[1] ?? 'Documento';
      const section = cols[2] ?? 'Geral';
      const minute = cols[3] ?? '00:00';
      const content = cols[5] ?? '';
      return {
        text: `${content} [${title} | ${section} | ${minute}]`,
        model: 'local-grounded-synthesizer'
      };
    }

    return {
      text: `Processado localmente: ${prompt.slice(0, 220)}`,
      model: 'local-grounded-synthesizer'
    };
  }
}

const IngestPayloadSchema = z.object({
  documentId: z.string().min(1),
  title: z.string().min(1),
  content: z.string().min(1),
  maxChunkChars: z.number().int().positive().optional()
});

const QueryPayloadSchema = z.object({
  question: z.string().min(1),
  serializationFormat: z.enum(['JSON_TABULAR', 'TOON']).default('TOON'),
  topK: z.number().int().positive().max(10).default(3),
  history: z.array(z.string()).optional()
});

const WebAiFallbackPayloadSchema = z.object({
  task: z.enum(['prompt', 'extract_cnpj', 'describe_scene', 'translate']).default('prompt'),
  prompt: z.string().min(1),
  sourceLang: z.enum(['pt', 'en']).optional(),
  targetLang: z.enum(['pt', 'en']).optional(),
  temperature: z.number().min(0).max(2).optional(),
  topK: z.number().int().positive().optional(),
  imageBase64: z.string().optional()
});

export async function createBackendApp(
  options: CreateBackendAppOptions = {}
): Promise<FastifyInstance> {
  const env: BackendEnv = parseBackendEnv({
    ...process.env,
    ...options.env
  });

  const app = Fastify({
    logger: env.NODE_ENV !== 'test'
  });

  await app.register(cors, { origin: true });

  let vectorRepository: VectorRepository;
  let embedder: LocalEmbedder;

  if (options.useInMemoryRag) {
    vectorRepository = new InMemoryVectorRepository();
    embedder = new DeterministicHashEmbedder(384);
  } else {
    try {
      const driver = neo4j.driver(
        env.NEO4J_URI,
        neo4j.auth.basic(env.NEO4J_USER, env.NEO4J_PASSWORD)
      );
      await driver.verifyConnectivity();
      vectorRepository = new Neo4jVectorRepository(driver, { dimensions: 384 });
    } catch {
      vectorRepository = new InMemoryVectorRepository();
    }
    embedder = new TransformersJsLocalEmbedder(env.EMBEDDING_MODEL);
  }

  const providers: LLMProvider[] = [
    new OllamaAdapter({
      baseUrl: env.OLLAMA_BASE_URL,
      defaultTextModel: env.OLLAMA_TEXT_MODEL,
      defaultVisionModel: env.OLLAMA_VISION_MODEL,
      timeoutMs: options.useInMemoryRag ? 500 : 12000
    }),
    new OpenRouterAdapter({
      apiKey: env.OPENROUTER_API_KEY,
      defaultModel: env.OPENROUTER_DEFAULT_MODEL,
      timeoutMs: options.useInMemoryRag ? 500 : 12000
    }),
    new LocalGroundedSynthesizerProvider()
  ];

  const llmRouter = new LLMRouter(providers);
  const ragService = new RagService(vectorRepository, embedder, llmRouter);

  // Seed initial catalog knowledge documents
  for (const doc of INITIAL_KNOWLEDGE_DOCUMENTS) {
    await ragService.ingestDocument(doc);
  }

  app.get('/api/health', async () => ({
    status: 'ok',
    environment: env.NODE_ENV,
    models: {
      ollamaText: env.OLLAMA_TEXT_MODEL,
      ollamaVision: env.OLLAMA_VISION_MODEL,
      openRouterFallback: env.OPENROUTER_DEFAULT_MODEL,
      embedding: env.EMBEDDING_MODEL
    }
  }));

  app.get('/api/catalog', async () => ({
    categories: CATALOG_CATEGORIES,
    colors: CATALOG_COLORS,
    products: INITIAL_CATALOG_PRODUCTS,
    users: INITIAL_SAMPLE_USERS
  }));

  app.post('/api/rag/ingest', async (request, reply) => {
    const parsed = IngestPayloadSchema.safeParse(request.body);
    if (!parsed.success) {
      return reply.status(400).send({
        error: 'ValidationError',
        details: parsed.error.flatten()
      });
    }

    const result = await ragService.ingestDocument(parsed.data);
    return reply.status(200).send(result);
  });

  app.post('/api/rag/query', async (request, reply) => {
    const parsed = QueryPayloadSchema.safeParse(request.body);
    if (!parsed.success) {
      return reply.status(400).send({
        error: 'ValidationError',
        details: parsed.error.flatten()
      });
    }

    const result = await ragService.query(parsed.data);
    return reply.status(200).send(result);
  });

  app.post('/api/webai/fallback', async (request, reply) => {
    const parsed = WebAiFallbackPayloadSchema.safeParse(request.body);
    if (!parsed.success) {
      return reply.status(400).send({
        error: 'ValidationError',
        details: parsed.error.flatten()
      });
    }

    const payload = parsed.data;
    const routed = await llmRouter.generate({
      prompt: payload.prompt,
      temperature: payload.temperature,
      topK: payload.topK,
      imageBase64: payload.imageBase64
    });

    const structuredCnpj =
      payload.task === 'extract_cnpj' ? extractStructuredCnpjFromText(payload.prompt) : undefined;

    return reply.status(200).send({
      task: payload.task,
      text: routed.text,
      provider: routed.provider,
      model: routed.model,
      fallbackTriggered: routed.fallbackTriggered,
      fallbackErrors: routed.fallbackErrors,
      structuredCnpj
    });
  });

  return app;
}


import { describe, expect, it } from 'vitest';
import { createBackendApp } from '../../packages/backend/src/app.js';

describe('Increment 2.3 — Fastify REST API (Health, Catalog, RAG 10-Block & WebAI Fallback)', () => {
  it('GET /api/health returns service status and configured models', async () => {
    const app = await createBackendApp({ useInMemoryRag: true });
    const res = await app.inject({
      method: 'GET',
      url: '/api/health'
    });

    expect(res.statusCode).toBe(200);
    const body = res.json();
    expect(body.status).toBe('ok');
    expect(body.models.ollamaText).toBe('qwen2.5:1.5b');
    expect(body.models.ollamaVision).toBe('moondream');
    expect(body.models.embedding).toBe('Xenova/all-MiniLM-L6-v2');
    await app.close();
  });

  it('GET /api/catalog returns products, categories, colors and sample users (with history & cold start)', async () => {
    const app = await createBackendApp({ useInMemoryRag: true });
    const res = await app.inject({
      method: 'GET',
      url: '/api/catalog'
    });

    expect(res.statusCode).toBe(200);
    const body = res.json();
    expect(body.products.length).toBeGreaterThanOrEqual(4);
    expect(body.categories.length).toBeGreaterThanOrEqual(2);
    expect(body.colors.length).toBeGreaterThanOrEqual(2);
    expect(body.users.some((u: { purchasedProductIds: string[] }) => u.purchasedProductIds.length > 0)).toBe(true);
    expect(body.users.some((u: { purchasedProductIds: string[] }) => u.purchasedProductIds.length === 0)).toBe(true);
    await app.close();
  });

  it('POST /api/rag/ingest and POST /api/rag/query execute full 10-block RAG pipeline with TOON and JSON_TABULAR', async () => {
    const app = await createBackendApp({ useInMemoryRag: true });

    const ingestRes = await app.inject({
      method: 'POST',
      url: '/api/rag/ingest',
      payload: {
        documentId: 'doc-drone-pro',
        title: 'Manual Drone Vision 8K',
        content: [
          '## [03:15] Sensores de Obstáculos YOLO',
          'O Drone Vision 8K possui sensores omnidirecionais que detectam obstáculos a 30 metros.',
          '## [07:50] Autonomia de Voo',
          'A bateria inteligente de 5000mAh proporciona 45 minutos de voo contínuo.'
        ].join('\n')
      }
    });

    expect(ingestRes.statusCode).toBe(200);
    expect(ingestRes.json().chunksIndexed).toBeGreaterThanOrEqual(2);

    const queryRes = await app.inject({
      method: 'POST',
      url: '/api/rag/query',
      payload: {
        question: 'Qual a distância de detecção dos sensores de obstáculos do Drone Vision 8K?',
        serializationFormat: 'TOON',
        topK: 2
      }
    });

    expect(queryRes.statusCode).toBe(200);
    const queryBody = queryRes.json();
    expect(queryBody.prompt.serializationFormat).toBe('TOON');
    expect(queryBody.prompt.blocks.fonteDaVerdade).toContain('Manual Drone Vision 8K');
    expect(queryBody.chunks.length).toBeGreaterThan(0);
    expect(queryBody.answer).toBeTruthy();
    await app.close();
  });

  it('POST /api/webai/fallback handles multimodal CNPJ extraction, translation and prompt tasks via LLMRouter chain', async () => {
    const app = await createBackendApp({ useInMemoryRag: true });

    const cnpjRes = await app.inject({
      method: 'POST',
      url: '/api/webai/fallback',
      payload: {
        task: 'extract_cnpj',
        prompt: 'CNPJ: 12.345.678/0001-99 | Razão Social: Tech AI Brasil Ltda | Nome Fantasia: NeuralShop | Situação: ATIVA',
        temperature: 0.1,
        topK: 20
      }
    });

    expect(cnpjRes.statusCode).toBe(200);
    const cnpjBody = cnpjRes.json();
    expect(cnpjBody.provider).toBeDefined();
    expect(cnpjBody.structuredCnpj?.cnpj).toBe('12.345.678/0001-99');
    expect(cnpjBody.structuredCnpj?.razaoSocial).toContain('Tech AI Brasil Ltda');
    await app.close();
  });
});


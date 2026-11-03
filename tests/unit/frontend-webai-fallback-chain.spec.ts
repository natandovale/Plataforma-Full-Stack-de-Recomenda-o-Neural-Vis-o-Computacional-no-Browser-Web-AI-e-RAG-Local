import { describe, expect, it, vi } from 'vitest';
import {
  BackendBridgeWebAiProvider,
  GeminiNanoWindowAiProvider,
  TransformersJsBrowserProvider,
  WebAIMultimodalChain,
  type WebAIProvider
} from '../../packages/frontend/src/modules/web-ai/services/web-ai-chain.js';

describe('Increment 5.1 — Web 4.0 Multimodal Assistant Fallback Chain (Gemini Nano -> Transformer.js -> Ollama -> OpenRouter)', () => {
  it('RN06: uses Chrome Built-in AI (window.ai / languageModel.create) with temperature, topK and streaming when supported', async () => {
    const createSessionSpy = vi.fn().mockResolvedValue({
      promptStreaming: async function* (prompt: string) {
        yield `Chunk 1 (${prompt.slice(0, 10)}) `;
        yield 'Chunk 2 [Gemini Nano]';
      },
      prompt: vi.fn().mockResolvedValue('Resposta direta Gemini Nano')
    });

    const geminiProvider = new GeminiNanoWindowAiProvider(() => ({
      languageModel: {
        create: createSessionSpy
      }
    }));

    const chunks: string[] = [];
    const chain = new WebAIMultimodalChain([geminiProvider]);
    const res = await chain.execute({
      task: 'prompt',
      prompt: 'Descreva a câmera mirrorless 4K',
      temperature: 0.3,
      topK: 15,
      onStreamChunk: (chunk) => chunks.push(chunk)
    });

    expect(createSessionSpy).toHaveBeenCalledWith({ temperature: 0.3, topK: 15 });
    expect(res.provider).toBe('gemini-nano');
    expect(res.fallbackChainUsed).toEqual(['gemini-nano']);
    expect(chunks.join('')).toContain('Chunk 2 [Gemini Nano]');
  });

  it('RN06: transparently falls back through Gemini Nano -> Transformer.js -> Ollama -> OpenRouter when local hardware lacks window.ai', async () => {
    const unavailableGemini = new GeminiNanoWindowAiProvider(() => undefined);

    const failingTransformers: WebAIProvider = {
      name: 'transformers-js',
      run: vi.fn().mockRejectedValue(new Error('WebGPU/WASM model not cached'))
    };

    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        text: 'Extraído via Ollama CPU container',
        provider: 'ollama',
        model: 'qwen2.5:1.5b',
        fallbackTriggered: false,
        fallbackErrors: [],
        structuredCnpj: {
          cnpj: '12.345.678/0001-99',
          razaoSocial: 'Tech AI Brasil Ltda',
          nomeFantasia: 'NeuralShop',
          situacaoCadastral: 'ATIVA'
        }
      })
    });

    const backendBridge = new BackendBridgeWebAiProvider('http://localhost:3001', fetchMock as never);

    const chain = new WebAIMultimodalChain([
      unavailableGemini,
      failingTransformers,
      backendBridge
    ]);

    const result = await chain.execute({
      task: 'extract_cnpj',
      prompt: 'CNPJ: 12.345.678/0001-99 | Razão Social: Tech AI Brasil Ltda | Nome Fantasia: NeuralShop | Situação: ATIVA'
    });

    expect(result.provider).toBe('ollama');
    expect(result.structuredCnpj?.cnpj).toBe('12.345.678/0001-99');
    expect(result.fallbackErrors).toHaveLength(2);
    expect(result.fallbackErrors[0]).toContain('gemini-nano');
    expect(result.fallbackErrors[1]).toContain('transformers-js');
  });

  it('RN06: executes offline in-browser CNPJ extraction and PT <-> EN translation via TransformersJsBrowserProvider when window.ai is absent', async () => {
    const unavailableGemini = new GeminiNanoWindowAiProvider(() => undefined);
    const localTransformers = new TransformersJsBrowserProvider();

    const chain = new WebAIMultimodalChain([unavailableGemini, localTransformers]);

    const cnpjResult = await chain.execute({
      task: 'extract_cnpj',
      prompt: 'CNPJ: 98.765.432/0001-10 | Razão Social: Visão Computacional Web S.A. | Nome Fantasia: VisionWeb | Situação: ATIVA'
    });

    expect(cnpjResult.provider).toBe('transformers-js');
    expect(cnpjResult.structuredCnpj?.cnpj).toBe('98.765.432/0001-10');
    expect(cnpjResult.structuredCnpj?.razaoSocial).toBe('Visão Computacional Web S.A.');

    const translationResult = await chain.execute({
      task: 'translate',
      prompt: 'Câmera 4K com autofoco ocular e estabilização óptica',
      sourceLang: 'pt',
      targetLang: 'en'
    });

    expect(translationResult.provider).toBe('transformers-js');
    expect(translationResult.text.toLowerCase()).toContain('4k camera');
  });
});


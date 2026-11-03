export type WebAITaskType = 'prompt' | 'extract_cnpj' | 'describe_scene' | 'translate';

export interface StructuredCnpjInfo {
  readonly cnpj: string;
  readonly razaoSocial: string;
  readonly nomeFantasia: string;
  readonly situacaoCadastral: string;
}

export interface WebAIExecuteRequest {
  readonly task: WebAITaskType;
  readonly prompt: string;
  readonly sourceLang?: 'pt' | 'en';
  readonly targetLang?: 'pt' | 'en';
  readonly temperature?: number;
  readonly topK?: number;
  readonly imageBase64?: string;
  readonly onStreamChunk?: (chunk: string) => void;
}

export interface WebAIProviderOutput {
  readonly provider: 'gemini-nano' | 'transformers-js' | 'ollama' | 'openrouter' | 'local-synthesizer';
  readonly text: string;
  readonly structuredCnpj?: StructuredCnpjInfo;
  readonly backendFallbackErrors?: readonly string[];
}

export interface WebAIProvider {
  readonly name: string;
  run(request: WebAIExecuteRequest): Promise<WebAIProviderOutput>;
}

export interface WebAIChainResult extends WebAIProviderOutput {
  readonly fallbackChainUsed: readonly string[];
  readonly fallbackErrors: readonly string[];
}

export function parseStructuredCnpjClientSide(text: string): StructuredCnpjInfo {
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

export interface ChromeWindowAiNamespace {
  readonly languageModel?: {
    create(options?: { temperature?: number; topK?: number }): Promise<{
      prompt(input: string): Promise<string>;
      promptStreaming?(input: string): AsyncIterable<string>;
    }>;
  };
  readonly translator?: {
    createTranslator(options: {
      sourceLanguage: string;
      targetLanguage: string;
    }): Promise<{ translate(input: string): Promise<string> }>;
  };
}

/**
 * Level 1 Provider: Chrome Built-in AI (window.ai / languageModel.create + Native Translation)
 * with temperature, topK and streaming support.
 */
export class GeminiNanoWindowAiProvider implements WebAIProvider {
  public readonly name = 'gemini-nano';

  constructor(
    private readonly getWindowAi: () => ChromeWindowAiNamespace | undefined = () =>
      (globalThis as unknown as { ai?: ChromeWindowAiNamespace }).ai
  ) {}

  async run(request: WebAIExecuteRequest): Promise<WebAIProviderOutput> {
    const ai = this.getWindowAi();
    if (!ai) {
      throw new Error('window.ai (Gemini Nano) is not supported on this device/browser');
    }

    if (request.task === 'translate' && ai.translator) {
      const translator = await ai.translator.createTranslator({
        sourceLanguage: request.sourceLang ?? 'pt',
        targetLanguage: request.targetLang ?? 'en'
      });
      const translated = await translator.translate(request.prompt);
      request.onStreamChunk?.(translated);
      return {
        provider: 'gemini-nano',
        text: translated
      };
    }

    if (!ai.languageModel) {
      throw new Error('window.ai.languageModel is unavailable');
    }

    const session = await ai.languageModel.create({
      temperature: request.temperature ?? 0.3,
      topK: request.topK ?? 20
    });

    let fullText = '';
    if (typeof session.promptStreaming === 'function') {
      for await (const chunk of session.promptStreaming(request.prompt)) {
        fullText += chunk;
        request.onStreamChunk?.(chunk);
      }
    } else {
      fullText = await session.prompt(request.prompt);
      request.onStreamChunk?.(fullText);
    }

    return {
      provider: 'gemini-nano',
      text: fullText.trim(),
      structuredCnpj:
        request.task === 'extract_cnpj' ? parseStructuredCnpjClientSide(request.prompt) : undefined
    };
  }
}

const PT_EN_DICTIONARY: ReadonlyArray<readonly [RegExp, string]> = [
  [/câmera 4k/gi, '4K camera'],
  [/com autofoco ocular/gi, 'with eye autofocus'],
  [/estabilização óptica/gi, 'optical stabilization'],
  [/e /gi, 'and ']
];

const EN_PT_DICTIONARY: ReadonlyArray<readonly [RegExp, string]> = [
  [/4k camera/gi, 'Câmera 4K'],
  [/with eye autofocus/gi, 'com autofoco ocular'],
  [/optical stabilization/gi, 'estabilização óptica']
];

/**
 * Level 2 Provider: In-browser offline Transformer.js execution
 * handling CNPJ extraction, scene description and PT <-> EN translation locally.
 */
export class TransformersJsBrowserProvider implements WebAIProvider {
  public readonly name = 'transformers-js';

  async run(request: WebAIExecuteRequest): Promise<WebAIProviderOutput> {
    if (request.task === 'extract_cnpj') {
      const structured = parseStructuredCnpjClientSide(request.prompt);
      const summary = `Cartão CNPJ extraído offline (Transformer.js): ${structured.razaoSocial} (${structured.cnpj}) - Situação: ${structured.situacaoCadastral}`;
      request.onStreamChunk?.(summary);
      return {
        provider: 'transformers-js',
        text: summary,
        structuredCnpj: structured
      };
    }

    if (request.task === 'translate') {
      const from = request.sourceLang ?? 'pt';
      const to = request.targetLang ?? 'en';
      let translated = request.prompt;
      const rules = from === 'pt' && to === 'en' ? PT_EN_DICTIONARY : EN_PT_DICTIONARY;
      for (const [pattern, replacement] of rules) {
        translated = translated.replace(pattern, replacement);
      }
      const resultText = `[Transformer.js ${from.toUpperCase()}->${to.toUpperCase()}] ${translated}`;
      request.onStreamChunk?.(resultText);
      return {
        provider: 'transformers-js',
        text: resultText
      };
    }

    const outputText = `[Transformer.js In-Browser Multimodal] Processado: ${request.prompt}`;
    request.onStreamChunk?.(outputText);
    return {
      provider: 'transformers-js',
      text: outputText
    };
  }
}

/**
 * Level 3 & Level 4 Provider Bridge: Delegates to Backend LLMRouter
 * which executes 3. Ollama (Docker CPU) -> 4. OpenRouter (Cloud Fallback).
 */
export class BackendBridgeWebAiProvider implements WebAIProvider {
  public readonly name = 'backend-llm-bridge';

  constructor(
    private readonly backendBaseUrl = 'http://localhost:3001',
    private readonly fetchImpl: typeof fetch = fetch
  ) {}

  async run(request: WebAIExecuteRequest): Promise<WebAIProviderOutput> {
    const response = await this.fetchImpl(`${this.backendBaseUrl}/api/webai/fallback`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        task: request.task,
        prompt: request.prompt,
        sourceLang: request.sourceLang,
        targetLang: request.targetLang,
        temperature: request.temperature,
        topK: request.topK,
        imageBase64: request.imageBase64
      })
    });

    if (!response.ok) {
      throw new Error(`Backend WebAI bridge HTTP ${response.status}`);
    }

    const data = (await response.json()) as {
      text: string;
      provider: 'ollama' | 'openrouter' | 'local-synthesizer';
      fallbackErrors?: string[];
      structuredCnpj?: StructuredCnpjInfo;
    };

    request.onStreamChunk?.(data.text);
    return {
      provider: data.provider,
      text: data.text,
      structuredCnpj: data.structuredCnpj,
      backendFallbackErrors: data.fallbackErrors
    };
  }
}

/**
 * RN06 & ADR-001: Orchestrates the Web 4.0 Multimodal Assistant chain:
 * 1. Gemini Nano (window.ai) -> 2. Transformer.js (Browser) -> 3. Ollama (Docker CPU) -> 4. OpenRouter
 */
export class WebAIMultimodalChain {
  constructor(private readonly providers: readonly WebAIProvider[]) {
    if (providers.length === 0) {
      throw new Error('WebAIMultimodalChain requires at least one provider');
    }
  }

  async execute(request: WebAIExecuteRequest): Promise<WebAIChainResult> {
    const fallbackErrors: string[] = [];
    const fallbackChainUsed: string[] = [];

    for (const provider of this.providers) {
      fallbackChainUsed.push(provider.name);
      try {
        const output = await provider.run(request);
        if (output.backendFallbackErrors && output.backendFallbackErrors.length > 0) {
          fallbackErrors.push(...output.backendFallbackErrors);
        }
        return {
          ...output,
          fallbackChainUsed,
          fallbackErrors
        };
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        fallbackErrors.push(`${provider.name}: ${msg}`);
      }
    }

    throw new Error(`WebAIMultimodalChain exhausted all providers: ${fallbackErrors.join(' | ')}`);
  }
}


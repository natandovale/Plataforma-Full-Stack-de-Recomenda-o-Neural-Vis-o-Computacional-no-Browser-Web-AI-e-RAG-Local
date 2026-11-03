export interface LLMGenerateRequest {
  readonly prompt: string;
  readonly temperature?: number;
  readonly topK?: number;
  readonly imageBase64?: string;
}

export interface LLMProviderResult {
  readonly text: string;
  readonly model: string;
}

export interface LLMProvider {
  readonly name: 'ollama' | 'openrouter' | 'local-synthesizer';
  generate(request: LLMGenerateRequest): Promise<LLMProviderResult>;
}

export interface RoutedLLMResponse extends LLMProviderResult {
  readonly provider: string;
  readonly fallbackTriggered: boolean;
  readonly fallbackErrors: readonly string[];
}

/**
 * RN08 & Section 7.3: Orchestrates LLM execution following the chain:
 * 1. Ollama (Local CPU Docker) -> 2. OpenRouter (Cloud Fallback),
 * preserving diagnostic failure reasons whenever fallback occurs.
 */
export class LLMRouter {
  constructor(private readonly providers: readonly LLMProvider[]) {
    if (providers.length === 0) {
      throw new Error('LLMRouter requires at least one LLMProvider');
    }
  }

  async generate(request: LLMGenerateRequest): Promise<RoutedLLMResponse> {
    const fallbackErrors: string[] = [];

    for (let index = 0; index < this.providers.length; index++) {
      const provider = this.providers[index]!;
      try {
        const result = await provider.generate(request);
        return {
          text: result.text,
          model: result.model,
          provider: provider.name,
          fallbackTriggered: index > 0,
          fallbackErrors
        };
      } catch (err) {
        const message = err instanceof Error ? err.message : String(err);
        fallbackErrors.push(`${provider.name}: ${message}`);
      }
    }

    throw new Error(`All LLM providers failed: ${fallbackErrors.join(' | ')}`);
  }
}

export interface OllamaAdapterConfig {
  readonly baseUrl: string;
  readonly defaultTextModel: string;
  readonly defaultVisionModel: string;
  readonly timeoutMs?: number;
  readonly fetchFn?: typeof fetch;
}

export class OllamaAdapter implements LLMProvider {
  public readonly name = 'ollama' as const;
  private readonly fetchImpl: typeof fetch;

  constructor(private readonly config: OllamaAdapterConfig) {
    this.fetchImpl = config.fetchFn ?? fetch;
  }

  async generate(request: LLMGenerateRequest): Promise<LLMProviderResult> {
    const model = request.imageBase64
      ? this.config.defaultVisionModel
      : this.config.defaultTextModel;

    const response = await this.fetchImpl(`${this.config.baseUrl}/api/generate`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model,
        prompt: request.prompt,
        images: request.imageBase64 ? [request.imageBase64] : undefined,
        stream: false,
        options: {
          temperature: request.temperature ?? 0.2,
          top_k: request.topK ?? 40
        }
      }),
      signal: AbortSignal.timeout(this.config.timeoutMs ?? 15000)
    });

    if (!response.ok) {
      throw new Error(`Ollama HTTP ${response.status}`);
    }

    const data = (await response.json()) as { response?: string };
    return {
      text: (data.response ?? '').trim(),
      model
    };
  }
}

export interface OpenRouterAdapterConfig {
  readonly apiKey: string;
  readonly defaultModel: string;
  readonly baseUrl?: string;
  readonly timeoutMs?: number;
  readonly fetchFn?: typeof fetch;
}

export class OpenRouterAdapter implements LLMProvider {
  public readonly name = 'openrouter' as const;
  private readonly fetchImpl: typeof fetch;

  constructor(private readonly config: OpenRouterAdapterConfig) {
    this.fetchImpl = config.fetchFn ?? fetch;
  }

  async generate(request: LLMGenerateRequest): Promise<LLMProviderResult> {
    if (!this.config.apiKey) {
      throw new Error('OPENROUTER_API_KEY is not configured');
    }

    const endpoint = `${this.config.baseUrl ?? 'https://openrouter.ai/api/v1'}/chat/completions`;
    const response = await this.fetchImpl(endpoint, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${this.config.apiKey}`
      },
      body: JSON.stringify({
        model: this.config.defaultModel,
        temperature: request.temperature ?? 0.2,
        top_k: request.topK ?? 40,
        messages: [{ role: 'user', content: request.prompt }]
      }),
      signal: AbortSignal.timeout(this.config.timeoutMs ?? 15000)
    });

    if (!response.ok) {
      throw new Error(`OpenRouter HTTP ${response.status}`);
    }

    const data = (await response.json()) as {
      choices?: Array<{ message?: { content?: string } }>;
    };
    const content = data.choices?.[0]?.message?.content ?? '';
    return {
      text: content.trim(),
      model: this.config.defaultModel
    };
  }
}


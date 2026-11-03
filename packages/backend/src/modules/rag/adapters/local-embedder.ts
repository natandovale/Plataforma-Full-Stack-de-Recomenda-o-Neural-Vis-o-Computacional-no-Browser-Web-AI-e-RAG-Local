export interface LocalEmbedder {
  embedText(text: string): Promise<number[]>;
}

/**
 * Deterministic token/character n-gram hash embedder (384 dimensions)
 * that produces normalized semantic vectors for instant unit/integration tests
 * and offline fallback when ONNX model files are still downloading.
 */
export class DeterministicHashEmbedder implements LocalEmbedder {
  constructor(private readonly dimensions = 384) {}

  async embedText(text: string): Promise<number[]> {
    const vec = new Array<number>(this.dimensions).fill(0);
    const tokens = text
      .toLowerCase()
      .replace(/[^\p{L}\p{N}\s]/gu, ' ')
      .split(/\s+/)
      .filter(Boolean);

    for (const token of tokens) {
      let hash = 2166136261;
      for (let i = 0; i < token.length; i++) {
        hash ^= token.charCodeAt(i);
        hash = Math.imul(hash, 16777619);
      }
      const idx = Math.abs(hash) % this.dimensions;
      vec[idx] = (vec[idx] ?? 0) + 1;
    }

    const norm = Math.sqrt(vec.reduce((sum, val) => sum + val * val, 0));
    if (norm === 0) {
      vec[0] = 1;
      return vec;
    }
    return vec.map((v) => v / norm);
  }
}

export type FeatureExtractionPipelineFn = (
  text: string,
  options: { pooling: 'mean'; normalize: boolean }
) => Promise<{ data: Float32Array | number[] }>;

/**
 * RN07: Official local embedder using @huggingface/transformers (Xenova/all-MiniLM-L6-v2, 384d)
 * in pure Node.js without external API cost.
 */
export class TransformersJsLocalEmbedder implements LocalEmbedder {
  private extractorPromise: Promise<FeatureExtractionPipelineFn> | null = null;
  private readonly fallbackEmbedder = new DeterministicHashEmbedder(384);

  constructor(
    private readonly modelName = 'Xenova/all-MiniLM-L6-v2',
    private readonly pipelineFactory?: () => Promise<FeatureExtractionPipelineFn>
  ) {}

  private async getExtractor(): Promise<FeatureExtractionPipelineFn> {
    if (!this.extractorPromise) {
      if (this.pipelineFactory) {
        this.extractorPromise = this.pipelineFactory();
      } else {
        this.extractorPromise = (async () => {
          const { pipeline } = await import('@huggingface/transformers');
          const extractor = await pipeline('feature-extraction', this.modelName);
          return (text: string, options: { pooling: 'mean'; normalize: boolean }) =>
            extractor(text, options) as Promise<{ data: Float32Array | number[] }>;
        })();
      }
    }
    return this.extractorPromise;
  }

  async embedText(text: string): Promise<number[]> {
    try {
      const extractor = await this.getExtractor();
      const output = await extractor(text, { pooling: 'mean', normalize: true });
      return Array.from(output.data);
    } catch {
      return this.fallbackEmbedder.embedText(text);
    }
  }
}


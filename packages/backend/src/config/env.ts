import { z } from 'zod';

export const BackendEnvSchema = z.object({
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  PORT: z.coerce.number().int().positive().max(65535).default(3001),
  NEO4J_URI: z.string().min(1).default('bolt://localhost:7687'),
  NEO4J_USER: z.string().min(1).default('neo4j'),
  NEO4J_PASSWORD: z.string().min(1).default('platform_secret_password'),
  OLLAMA_BASE_URL: z.string().url().default('http://localhost:11434'),
  OLLAMA_TEXT_MODEL: z.string().min(1).default('qwen2.5:1.5b'),
  OLLAMA_VISION_MODEL: z.string().min(1).default('moondream'),
  OPENROUTER_API_KEY: z.string().optional().default(''),
  OPENROUTER_DEFAULT_MODEL: z.string().min(1).default('google/gemini-2.0-flash-exp:free'),
  EMBEDDING_MODEL: z.string().min(1).default('Xenova/all-MiniLM-L6-v2')
});

export type BackendEnv = z.infer<typeof BackendEnvSchema>;

export function parseBackendEnv(rawEnv: Record<string, string | undefined> = process.env): BackendEnv {
  return BackendEnvSchema.parse(rawEnv);
}


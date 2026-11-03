import { Ajv } from 'ajv';
import { z } from 'zod';
import {
  type RagChunkWithMetadata,
  type SourceOfTruthSerializationFormat,
  serializeSourceOfTruth
} from '../serializers/source-of-truth-serializer.js';

export const TEN_BLOCK_KEYS = [
  'contexto',
  'tom',
  'fonteDaVerdade',
  'contratoOperacional',
  'exemplos',
  'historico',
  'pedido',
  'raciocinio',
  'formato',
  'restricoes'
] as const;

const nonEmptyTrimmedString = z.string().trim().min(1);

export const TenBlockStructSchema = z.object({
  contexto: nonEmptyTrimmedString,
  tom: nonEmptyTrimmedString,
  fonteDaVerdade: nonEmptyTrimmedString,
  contratoOperacional: nonEmptyTrimmedString,
  exemplos: nonEmptyTrimmedString,
  historico: nonEmptyTrimmedString,
  pedido: nonEmptyTrimmedString,
  raciocinio: nonEmptyTrimmedString,
  formato: nonEmptyTrimmedString,
  restricoes: nonEmptyTrimmedString
});

export const TenBlockRagPromptSchema = z.object({
  serializationFormat: z.enum(['JSON_TABULAR', 'TOON']),
  blocks: TenBlockStructSchema
});

export type TenBlockStruct = z.infer<typeof TenBlockStructSchema>;
export type TenBlockRagPrompt = z.infer<typeof TenBlockRagPromptSchema>;

const ajvInstance = new Ajv({ allErrors: true });

export const tenBlockJsonSchema = {
  type: 'object',
  required: ['serializationFormat', 'blocks'],
  additionalProperties: false,
  properties: {
    serializationFormat: {
      type: 'string',
      enum: ['JSON_TABULAR', 'TOON']
    },
    blocks: {
      type: 'object',
      required: [...TEN_BLOCK_KEYS],
      additionalProperties: false,
      properties: {
        contexto: { type: 'string', minLength: 1, pattern: '\\S' },
        tom: { type: 'string', minLength: 1, pattern: '\\S' },
        fonteDaVerdade: { type: 'string', minLength: 1, pattern: '\\S' },
        contratoOperacional: { type: 'string', minLength: 1, pattern: '\\S' },
        exemplos: { type: 'string', minLength: 1, pattern: '\\S' },
        historico: { type: 'string', minLength: 1, pattern: '\\S' },
        pedido: { type: 'string', minLength: 1, pattern: '\\S' },
        raciocinio: { type: 'string', minLength: 1, pattern: '\\S' },
        formato: { type: 'string', minLength: 1, pattern: '\\S' },
        restricoes: { type: 'string', minLength: 1, pattern: '\\S' }
      }
    }
  }
} as const;

const validateAjvCompiled = ajvInstance.compile(tenBlockJsonSchema);

export interface BuildTenBlockPromptInput {
  readonly question: string;
  readonly chunks: readonly RagChunkWithMetadata[];
  readonly serializationFormat?: SourceOfTruthSerializationFormat;
  readonly history?: readonly string[];
}

/**
 * RN08: Builds a structured 10-block anti-hallucination RAG prompt
 * injecting the Neo4j retrieved chunks serialized in TOON or JSON Tabular.
 */
export function buildTenBlockRagPrompt(input: BuildTenBlockPromptInput): TenBlockRagPrompt {
  const format: SourceOfTruthSerializationFormat = input.serializationFormat ?? 'TOON';
  const serializedSource =
    input.chunks.length > 0
      ? serializeSourceOfTruth(input.chunks, format)
      : format === 'TOON'
        ? '@schema[id|title|section|videoMinute|score|text]\nNONE'
        : JSON.stringify({ columns: ['id', 'title', 'section', 'videoMinute', 'score', 'text'], rows: [] });

  const historyText =
    input.history && input.history.length > 0
      ? input.history.join(' | ')
      : 'Sem interações anteriores na sessão.';

  return {
    serializationFormat: format,
    blocks: {
      contexto:
        'Assistente técnico da Plataforma de Catálogo Inteligente, Visão Computacional e Recomendação Neural.',
      tom: 'Objetivo, técnico, claro e estritamente factual.',
      fonteDaVerdade: serializedSource,
      contratoOperacional:
        'Responda exclusivamente com base nos chunks fornecidos no bloco fonteDaVerdade, citando sempre [title | section | videoMinute].',
      exemplos:
        'Pergunta: Qual a taxa de quadros do autofoco? -> Resposta: O autofoco opera a 60 fps [Manual Camera Pro 4K | Autofoco e Lentes | 04:15].',
      historico: historyText,
      pedido: input.question.trim(),
      raciocinio:
        '1. Localizar nos chunks os termos da pergunta. 2. Verificar compatibilidade dos metadados (título, secção, minuto). 3. Redigir resposta apenas com fatos comprovados.',
      formato:
        'Texto estruturado acompanhado das citações exatas no padrão [title | section | videoMinute].',
      restricoes:
        'Proibido inventar especificações, extrapolar dados fora da fonteDaVerdade ou omitir metadados de origem.'
    }
  };
}

export function validateTenBlockPromptWithZod(prompt: unknown) {
  return TenBlockRagPromptSchema.safeParse(prompt);
}

export function validateTenBlockPromptWithAjv(prompt: unknown): {
  valid: boolean;
  errors: string[];
} {
  const valid = Boolean(validateAjvCompiled(prompt));
  const errors = (validateAjvCompiled.errors ?? []).map(
    (err) => `${err.instancePath || '/'} ${err.message ?? 'invalid'}`
  );
  return { valid, errors };
}

/**
 * Renders the 10-block prompt into a deterministic string payload for LLM execution.
 */
export function renderTenBlockPromptToText(prompt: TenBlockRagPrompt): string {
  const { blocks } = prompt;
  return [
    `[1. CONTEXTO]\n${blocks.contexto}`,
    `[2. TOM]\n${blocks.tom}`,
    `[3. FONTE DA VERDADE (${prompt.serializationFormat})]\n${blocks.fonteDaVerdade}`,
    `[4. CONTRATO OPERACIONAL]\n${blocks.contratoOperacional}`,
    `[5. EXEMPLOS]\n${blocks.exemplos}`,
    `[6. HISTÓRICO]\n${blocks.historico}`,
    `[7. PEDIDO]\n${blocks.pedido}`,
    `[8. RACIOCÍNIO]\n${blocks.raciocinio}`,
    `[9. FORMATO]\n${blocks.formato}`,
    `[10. RESTRIÇÕES]\n${blocks.restricoes}`
  ].join('\n\n');
}


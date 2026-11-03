import { describe, expect, it } from 'vitest';
import {
  type RagChunkWithMetadata,
  serializeChunksToJsonTabular,
  serializeChunksToToon
} from '../../packages/shared/src/serializers/source-of-truth-serializer.js';
import {
  TEN_BLOCK_KEYS,
  buildTenBlockRagPrompt,
  validateTenBlockPromptWithAjv,
  validateTenBlockPromptWithZod
} from '../../packages/shared/src/schemas/rag-prompt-schema.js';

const sampleChunks: RagChunkWithMetadata[] = [
  {
    id: 'chunk-01',
    title: 'Manual Camera Pro 4K',
    section: 'Autofoco e Lentes',
    videoMinute: '04:15',
    score: 0.94,
    text: 'O sistema de autofoco híbrido detecta olhos humanos e animais a 60 quadros por segundo.'
  },
  {
    id: 'chunk-02',
    title: 'Review Prático Camera Pro 4K',
    section: 'Estabilização Óptica',
    videoMinute: '11:40',
    score: 0.88,
    text: 'A estabilização de 5 eixos compensa até 5.5 stops de exposição em gravações noturnas.'
  }
];

describe('Increment 1.2 — JSON Tabular / TOON Serializers & 10-Block Anti-Hallucination Prompt', () => {
  describe('RN07 & RN08: Source of Truth Serializers (JSON Tabular & TOON)', () => {
    it('serializes RAG chunks with mandatory metadata (title, section, videoMinute) into JSON Tabular format', () => {
      const tabular = serializeChunksToJsonTabular(sampleChunks);
      const parsed = JSON.parse(tabular) as { columns: string[]; rows: unknown[][] };

      expect(parsed.columns).toEqual(['id', 'title', 'section', 'videoMinute', 'score', 'text']);
      expect(parsed.rows).toHaveLength(2);
      expect(parsed.rows[0]).toEqual([
        'chunk-01',
        'Manual Camera Pro 4K',
        'Autofoco e Lentes',
        '04:15',
        0.94,
        'O sistema de autofoco híbrido detecta olhos humanos e animais a 60 quadros por segundo.'
      ]);
    });

    it('serializes RAG chunks into TOON (Token Oriented Object Notation) with compact token footprint', () => {
      const standardJson = JSON.stringify(sampleChunks);
      const tabularJson = serializeChunksToJsonTabular(sampleChunks);
      const toon = serializeChunksToToon(sampleChunks);

      expect(toon).toContain('@schema[id|title|section|videoMinute|score|text]');
      expect(toon).toContain(
        'chunk-01|Manual Camera Pro 4K|Autofoco e Lentes|04:15|0.94|O sistema de autofoco híbrido detecta olhos humanos e animais a 60 quadros por segundo.'
      );
      // Both tabular JSON and TOON must be more compact than verbose array of objects JSON
      expect(tabularJson.length).toBeLessThan(standardJson.length);
      expect(toon.length).toBeLessThan(tabularJson.length);
    });

    it('sanitizes pipe and newline characters in TOON serialization to preserve column alignment', () => {
      const dirtyChunk: RagChunkWithMetadata[] = [
        {
          id: 'c-99',
          title: 'Doc | Especial',
          section: 'Sec\n01',
          videoMinute: '01:00',
          score: 0.75,
          text: 'Linha 1\nLinha 2 | final'
        }
      ];

      const toon = serializeChunksToToon(dirtyChunk);
      const lines = toon.trim().split('\n');
      expect(lines).toHaveLength(2);
      expect(lines[1]?.split('|')).toHaveLength(6);
    });
  });

  describe('RN08: 10-Block Anti-Hallucination Prompt Builder & Zod/Ajv Validation', () => {
    it('defines all 10 mandatory anti-hallucination blocks', () => {
      expect(TEN_BLOCK_KEYS).toEqual([
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
      ]);
    });

    it('builds a valid 10-block prompt using TOON or JSON_TABULAR and validates with both Zod and Ajv', () => {
      const prompt = buildTenBlockRagPrompt({
        question: 'Como funciona o autofoco e a estabilização da Camera Pro 4K?',
        chunks: sampleChunks,
        serializationFormat: 'TOON',
        history: ['Utilizador pesquisou câmeras 4K no catálogo.']
      });

      const zodResult = validateTenBlockPromptWithZod(prompt);
      const ajvResult = validateTenBlockPromptWithAjv(prompt);

      expect(zodResult.success).toBe(true);
      expect(ajvResult.valid).toBe(true);
      expect(prompt.blocks.fonteDaVerdade).toContain('@schema[id|title|section|videoMinute|score|text]');
      expect(prompt.blocks.pedido).toBe('Como funciona o autofoco e a estabilização da Camera Pro 4K?');
    });

    it('fails validation in both Zod and Ajv if any of the 10 blocks is missing or empty', () => {
      const invalidPrompt = {
        serializationFormat: 'TOON',
        blocks: {
          contexto: 'Contexto válido',
          tom: ' Técnico ',
          fonteDaVerdade: '', // Empty block must be rejected
          contratoOperacional: 'Apenas fatos da fonte da verdade',
          exemplos: 'Exemplo 1',
          historico: 'Sem histórico',
          pedido: 'Pergunta?',
          raciocinio: 'Passo a passo',
          formato: 'JSON',
          restricoes: 'Não inventar'
        }
      };

      const zodResult = validateTenBlockPromptWithZod(invalidPrompt);
      const ajvResult = validateTenBlockPromptWithAjv(invalidPrompt);

      expect(zodResult.success).toBe(false);
      expect(ajvResult.valid).toBe(false);
    });
  });
});


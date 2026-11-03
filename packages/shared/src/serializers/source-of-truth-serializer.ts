export interface RagChunkWithMetadata {
  readonly id: string;
  readonly title: string;
  readonly section: string;
  readonly videoMinute: string;
  readonly score: number;
  readonly text: string;
}

export type SourceOfTruthSerializationFormat = 'JSON_TABULAR' | 'TOON';

export const RAG_CHUNK_COLUMNS = [
  'id',
  'title',
  'section',
  'videoMinute',
  'score',
  'text'
] as const;

export interface JsonTabularPayload {
  readonly columns: readonly string[];
  readonly rows: readonly (readonly [string, string, string, string, number, string])[];
}

function sanitizeToonField(value: string): string {
  return value.replace(/\r?\n/g, ' ').replace(/\|/g, '/').trim();
}

/**
 * RN08: Serializes RAG chunks into compact JSON Tabular format ({ columns, rows })
 * eliminating key repetition across retrieved chunks.
 */
export function serializeChunksToJsonTabular(chunks: readonly RagChunkWithMetadata[]): string {
  const payload: JsonTabularPayload = {
    columns: RAG_CHUNK_COLUMNS,
    rows: chunks.map((chunk) => [
      chunk.id,
      chunk.title,
      chunk.section,
      chunk.videoMinute,
      Number(chunk.score.toFixed(4)),
      chunk.text
    ])
  };
  return JSON.stringify(payload);
}

/**
 * RN08: Serializes RAG chunks into TOON (Token Oriented Object Notation)
 * for maximum token economy in local/cloud LLMs.
 */
export function serializeChunksToToon(chunks: readonly RagChunkWithMetadata[]): string {
  const header = `@schema[${RAG_CHUNK_COLUMNS.join('|')}]`;
  const rows = chunks.map((chunk) =>
    [
      sanitizeToonField(chunk.id),
      sanitizeToonField(chunk.title),
      sanitizeToonField(chunk.section),
      sanitizeToonField(chunk.videoMinute),
      Number(chunk.score.toFixed(4)).toString(),
      sanitizeToonField(chunk.text)
    ].join('|')
  );
  return [header, ...rows].join('\n');
}

export function serializeSourceOfTruth(
  chunks: readonly RagChunkWithMetadata[],
  format: SourceOfTruthSerializationFormat
): string {
  return format === 'TOON'
    ? serializeChunksToToon(chunks)
    : serializeChunksToJsonTabular(chunks);
}


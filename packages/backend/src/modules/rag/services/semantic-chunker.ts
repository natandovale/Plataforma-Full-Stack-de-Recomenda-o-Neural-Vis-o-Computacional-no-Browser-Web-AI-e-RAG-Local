export interface RawDocumentInput {
  readonly documentId: string;
  readonly title: string;
  readonly content: string;
  readonly defaultSection?: string;
  readonly defaultVideoMinute?: string;
  readonly maxChunkChars?: number;
}

export interface SemanticChunk {
  readonly id: string;
  readonly documentId: string;
  readonly title: string;
  readonly section: string;
  readonly videoMinute: string;
  readonly text: string;
}

const HEADING_WITH_MINUTE_REGEX = /^#{1,4}\s*(?:\[(\d{1,2}:\d{2})\])?\s*(.+)$/;
const INLINE_MINUTE_REGEX = /\[(\d{1,2}:\d{2})\]/;

/**
 * RN07: Splits a document or video transcription into semantic chunks
 * enriched with mandatory metadata: title, section, and videoMinute.
 */
export function chunkDocumentSemantically(input: RawDocumentInput): SemanticChunk[] {
  const maxChars = input.maxChunkChars ?? 420;
  let currentSection = input.defaultSection ?? 'Geral';
  let currentMinute = input.defaultVideoMinute ?? '00:00';

  const lines = input.content.split(/\r?\n/);
  const chunks: SemanticChunk[] = [];
  let buffer: string[] = [];
  let chunkCounter = 1;

  const flushBuffer = () => {
    const combined = buffer.join(' ').replace(/\s+/g, ' ').trim();
    if (combined.length > 0) {
      chunks.push({
        id: `${input.documentId}-chunk-${chunkCounter++}`,
        documentId: input.documentId,
        title: input.title,
        section: currentSection,
        videoMinute: currentMinute,
        text: combined
      });
    }
    buffer = [];
  };

  for (const rawLine of lines) {
    const line = rawLine.trim();
    if (!line) {
      continue;
    }

    const headingMatch = HEADING_WITH_MINUTE_REGEX.exec(line);
    if (headingMatch) {
      flushBuffer();
      if (headingMatch[1]) {
        currentMinute = headingMatch[1];
      }
      currentSection = (headingMatch[2] ?? 'Geral').trim();
      continue;
    }

    const inlineMinuteMatch = INLINE_MINUTE_REGEX.exec(line);
    if (inlineMinuteMatch?.[1]) {
      currentMinute = inlineMinuteMatch[1];
    }

    const currentLength = buffer.join(' ').length;
    if (currentLength > 0 && currentLength + line.length + 1 > maxChars) {
      flushBuffer();
    }
    buffer.push(line);
  }

  flushBuffer();
  return chunks;
}


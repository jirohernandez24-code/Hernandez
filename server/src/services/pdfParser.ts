import pdf from 'pdf-parse';

export interface ParsedPDF {
  text: string;
  numPages: number;
  info: Record<string, unknown>;
  chunks: string[];
}

export async function parsePDF(buffer: Buffer): Promise<ParsedPDF> {
  const data = await pdf(buffer);

  const chunks = chunkText(data.text, 2000);

  return {
    text: data.text,
    numPages: data.numpages,
    info: data.info as Record<string, unknown>,
    chunks,
  };
}

function chunkText(text: string, maxChunkSize: number): string[] {
  const paragraphs = text.split(/\n\s*\n/);
  const chunks: string[] = [];
  let currentChunk = '';

  for (const paragraph of paragraphs) {
    const trimmed = paragraph.trim();
    if (!trimmed) continue;

    if (currentChunk.length + trimmed.length + 2 > maxChunkSize && currentChunk) {
      chunks.push(currentChunk.trim());
      currentChunk = '';
    }
    currentChunk += trimmed + '\n\n';
  }

  if (currentChunk.trim()) {
    chunks.push(currentChunk.trim());
  }

  return chunks;
}

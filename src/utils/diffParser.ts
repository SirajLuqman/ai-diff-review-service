import { Buffer } from 'node:buffer';

export interface DiffLine {
  content: string;
  newLineNumber: number;
}

export interface DiffFile {
  path: string;
  addedLines: DiffLine[];
  rawContent: string;
}

/**
 * Parses a unified diff into structured file objects with target (new file) line numbers.
 */
export function parseUnifiedDiff(rawDiff: string): DiffFile[] {
  const files: DiffFile[] = [];
  const lines = rawDiff.split(/\r?\n/);

  let currentFile: DiffFile | null = null;
  let currentTargetLine = 0;
  let fileRawLines: string[] = [];

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    if (line === undefined) continue;

    // Detect new file header: "+++ b/src/db.ts" or "+++ src/db.ts"
    if (line.startsWith('+++ ')) {
      if (currentFile) {
        currentFile.rawContent = fileRawLines.join('\n');
        files.push(currentFile);
      }

      let filePath = line.substring(4).trim();
      if (filePath.startsWith('b/')) {
        filePath = filePath.substring(2);
      }

      currentFile = {
        path: filePath,
        addedLines: [],
        rawContent: '',
      };
      fileRawLines = [line];
      continue;
    }

    if (!currentFile) continue;
    fileRawLines.push(line);

    // Detect hunk header: "@@ -10,4 +10,6 @@"
    const hunkMatch = line.match(/^@@\s+-\d+(?:,\d+)?\s+\+(\d+)(?:,\d+)?\s+@@/);
    if (hunkMatch && hunkMatch[1]) {
      currentTargetLine = parseInt(hunkMatch[1], 10);
      continue;
    }

    if (line.startsWith('+') && !line.startsWith('+++')) {
      // Added line
      currentFile.addedLines.push({
        content: line.substring(1), // line without leading '+'
        newLineNumber: currentTargetLine,
      });
      currentTargetLine++;
    } else if (line.startsWith(' ')) {
      // Context line
      currentTargetLine++;
    }
    // Deleted lines ('-') do not advance the new file line counter
  }

  if (currentFile) {
    currentFile.rawContent = fileRawLines.join('\n');
    files.push(currentFile);
  }

  return files;
}

/**
 * Chunks diffs over 64 KiB strictly on file boundaries.
 * Single files > 64 KiB form their own individual chunk.
 */
export function chunkDiffByFileBoundary(rawDiff: string): { chunks: DiffFile[][]; count: number } {
  const parsedFiles = parseUnifiedDiff(rawDiff);
  const CHUNK_LIMIT_BYTES = 65536; // 64 KiB

  if (parsedFiles.length === 0) {
    return { chunks: [], count: 1 };
  }

  const chunks: DiffFile[][] = [];
  let currentChunk: DiffFile[] = [];
  let currentChunkSize = 0;

  for (const file of parsedFiles) {
    const fileSize = Buffer.byteLength(file.rawContent, 'utf-8');

    if (currentChunkSize + fileSize > CHUNK_LIMIT_BYTES && currentChunk.length > 0) {
      chunks.push(currentChunk);
      currentChunk = [file];
      currentChunkSize = fileSize;
    } else {
      currentChunk.push(file);
      currentChunkSize += fileSize;
    }
  }

  if (currentChunk.length > 0) {
    chunks.push(currentChunk);
  }

  return {
    chunks,
    count: Math.max(1, chunks.length),
  };
}
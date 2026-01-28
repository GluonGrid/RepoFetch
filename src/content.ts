import type { FileEntry } from "./types.js";
import { GitHubClient } from "./github.js";

const DEFAULT_CONCURRENCY = 5;
const DEFAULT_MAX_FILE_SIZE = 1024 * 1024; // 1MB

export interface FetchContentOptions {
  concurrency?: number;
  maxFileSize?: number;
  filterShas?: Set<string> | null;
  onProgress?: (completed: number, total: number) => void;
}

export async function fetchContent(
  client: GitHubClient,
  repo: string,
  entries: FileEntry[],
  options: FetchContentOptions = {}
): Promise<FileEntry[]> {
  const {
    concurrency = DEFAULT_CONCURRENCY,
    maxFileSize = DEFAULT_MAX_FILE_SIZE,
    filterShas = null,
    onProgress,
  } = options;

  // Filter to only files that need content fetched
  const filesToFetch = entries.filter((e) => {
    if (e.type !== "file") return false;
    if (e.size && e.size > maxFileSize) return false;
    // If specific SHAs requested, only fetch those
    if (filterShas && !filterShas.has(e.sha)) return false;
    return true;
  });

  if (filesToFetch.length === 0) {
    return entries;
  }

  let completed = 0;

  // Process in batches with concurrency limit
  const results = new Map<string, string>();

  for (let i = 0; i < filesToFetch.length; i += concurrency) {
    const batch = filesToFetch.slice(i, i + concurrency);

    const batchResults = await Promise.allSettled(
      batch.map(async (entry) => {
        const content = await client.getBlobContent(repo, entry.sha);
        return { sha: entry.sha, content };
      })
    );

    for (const result of batchResults) {
      if (result.status === "fulfilled") {
        results.set(result.value.sha, result.value.content);
      }
      completed++;
      onProgress?.(completed, filesToFetch.length);
    }
  }

  // Merge content back into entries
  return entries.map((entry) => {
    if (entry.type === "file" && results.has(entry.sha)) {
      return { ...entry, content: results.get(entry.sha) };
    }
    return entry;
  });
}

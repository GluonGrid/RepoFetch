export { GitHubClient } from "./github.js";
export { filterTree, sortEntries } from "./filter.js";
export { fetchContent } from "./content.js";
export { formatOutput, formatContentOutput } from "./output.js";
export type {
  TreeItem,
  TreeResponse,
  BlobResponse,
  FileEntry,
  RepoFetchResult,
  RepoFetchOptions,
  EntryType,
} from "./types.js";
export type { FilterOptions } from "./filter.js";
export type { FetchContentOptions } from "./content.js";
export type { OutputFormat, OutputOptions } from "./output.js";

import { GitHubClient } from "./github.js";
import { filterTree, sortEntries } from "./filter.js";
import { fetchContent } from "./content.js";
import type { RepoFetchResult, RepoFetchOptions } from "./types.js";

export async function repofetch(
  repo: string,
  options: RepoFetchOptions = {}
): Promise<RepoFetchResult> {
  const {
    branch = "main",
    token,
    extensions,
    exclude,
    include,
    type,
    content = false,
    shas,
    maxFileSize = 1024 * 1024,
    concurrency = 5,
  } = options;

  const client = new GitHubClient(token);

  // Get the tree
  const { tree, branch: actualBranch } = await client.getTree(repo, branch);

  // Filter entries
  let entries = filterTree(tree.tree, {
    extensions,
    exclude,
    include,
    type,
    maxFileSize: content ? maxFileSize : undefined,
  });

  // Sort entries
  entries = sortEntries(entries);

  // Fetch content if requested
  if (content || (shas && shas.length > 0)) {
    // If specific SHAs provided, only fetch those
    const shaSet = shas ? new Set(shas) : null;
    entries = await fetchContent(client, repo, entries, {
      concurrency,
      maxFileSize,
      filterShas: shaSet,
    });
  }

  return {
    repo,
    branch: actualBranch,
    truncated: tree.truncated,
    files: entries,
  };
}

export default repofetch;

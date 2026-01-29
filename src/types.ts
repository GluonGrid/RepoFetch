export interface TreeItem {
  path: string;
  mode: string;
  type: "blob" | "tree";
  sha: string;
  size?: number;
}

export interface TreeResponse {
  sha: string;
  tree: TreeItem[];
  truncated: boolean;
}

export interface BlobResponse {
  sha: string;
  content: string;
  encoding: "base64";
  size: number;
}

export interface FileEntry {
  path: string;
  type: "file" | "directory";
  sha: string;
  size?: number;
  extension?: string;
  content?: string;
}

export interface RepoFetchResult {
  repo: string;
  branch: string;
  truncated: boolean;
  files: FileEntry[];
  rateLimit?: RateLimitInfo;
  isAuthenticated?: boolean;
}

export type EntryType = "file" | "dir" | "all";

export interface RateLimitInfo {
  limit: number;
  remaining: number;
  used: number;
  reset: Date;
}

export interface RepoFetchOptions {
  branch?: string;
  token?: string;
  extensions?: string[];
  exclude?: string[];
  include?: string[];
  type?: EntryType;
  content?: boolean;
  shas?: string[];
  maxFileSize?: number;
  concurrency?: number;
}

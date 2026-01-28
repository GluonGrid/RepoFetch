import type { TreeItem, FileEntry, EntryType } from "./types.js";
import path from "path";

export interface FilterOptions {
  extensions?: string[];
  exclude?: string[];
  include?: string[];
  type?: EntryType;
  maxFileSize?: number;
}

function getExtension(filePath: string): string {
  const ext = path.extname(filePath);
  return ext.toLowerCase();
}

function matchesPattern(filePath: string, pattern: string): boolean {
  // Simple pattern matching: supports wildcards and exact matches
  if (pattern.includes("*")) {
    const regex = new RegExp(
      "^" + pattern.replace(/\./g, "\\.").replace(/\*/g, ".*") + "$"
    );
    return regex.test(filePath) || regex.test(path.basename(filePath));
  }
  // Check if pattern matches any part of the path
  return filePath.includes(pattern) || path.basename(filePath).includes(pattern);
}

export function filterTree(items: TreeItem[], options: FilterOptions): FileEntry[] {
  const { extensions, exclude, include, maxFileSize } = options;

  // Type filter: always defaults to "all" for consistency
  const typeFilter = options.type ?? "all";

  const entries: FileEntry[] = [];

  for (const item of items) {
    const isFile = item.type === "blob";
    const isDir = item.type === "tree";
    const ext = getExtension(item.path);

    // Apply type filter
    if (typeFilter === "file" && !isFile) continue;
    if (typeFilter === "dir" && !isDir) continue;

    // Skip if doesn't match include patterns (if specified)
    if (include && include.length > 0) {
      const matches = include.some((pattern) => matchesPattern(item.path, pattern));
      if (!matches) continue;
    }

    // Skip if matches exclude patterns
    if (exclude && exclude.length > 0) {
      const matches = exclude.some((pattern) => matchesPattern(item.path, pattern));
      if (matches) continue;
    }

    // For files, apply extension filter
    if (isFile) {
      if (extensions && extensions.length > 0) {
        const normalizedExts = extensions.map((e) =>
          e.startsWith(".") ? e.toLowerCase() : `.${e.toLowerCase()}`
        );
        if (!normalizedExts.includes(ext)) continue;
      }

      // Skip files that are too large
      if (maxFileSize && item.size && item.size > maxFileSize) continue;
    }

    entries.push({
      path: item.path,
      type: isFile ? "file" : "directory",
      sha: item.sha,
      size: item.size,
      extension: isFile ? ext || undefined : undefined,
    });
  }

  return entries;
}

export function sortEntries(entries: FileEntry[]): FileEntry[] {
  // Build hierarchy and sort folders first, then alphabetically
  return entries.sort((a, b) => {
    const aParts = a.path.split("/");
    const bParts = b.path.split("/");

    // Compare each part of the path
    const minLen = Math.min(aParts.length, bParts.length);
    for (let i = 0; i < minLen; i++) {
      const aIsLast = i === aParts.length - 1;
      const bIsLast = i === bParts.length - 1;

      // If one is a directory at this level and other is file
      if (!aIsLast && bIsLast) return -1;
      if (aIsLast && !bIsLast) return 1;

      // Same level, compare names
      const cmp = aParts[i].localeCompare(bParts[i]);
      if (cmp !== 0) return cmp;
    }

    return aParts.length - bParts.length;
  });
}

import type { FileEntry, RepoFetchResult } from "./types.js";

export type OutputFormat = "ascii" | "json" | "json-pretty" | "paths";

export interface OutputOptions {
  format: OutputFormat;
  icons?: boolean;
  showSize?: boolean;
  showContent?: boolean;
}

export function formatOutput(result: RepoFetchResult, options: OutputOptions): string {
  switch (options.format) {
    case "json":
      return JSON.stringify(result);
    case "json-pretty":
      return JSON.stringify(result, null, 2);
    case "paths":
      return result.files.map((f) => f.path).join("\n");
    case "ascii":
    default:
      return formatAsciiTree(result, options);
  }
}

interface TreeNode {
  name: string;
  entry?: FileEntry;
  children: Map<string, TreeNode>;
}

function buildTree(entries: FileEntry[]): TreeNode {
  const root: TreeNode = { name: "", children: new Map() };

  for (const entry of entries) {
    const parts = entry.path.split("/");
    let current = root;

    for (let i = 0; i < parts.length; i++) {
      const part = parts[i];
      const isLast = i === parts.length - 1;

      if (!current.children.has(part)) {
        current.children.set(part, {
          name: part,
          children: new Map(),
        });
      }

      const node = current.children.get(part)!;
      if (isLast) {
        node.entry = entry;
      }
      current = node;
    }
  }

  return root;
}

function sortNodes(nodes: TreeNode[]): TreeNode[] {
  return nodes.sort((a, b) => {
    const aIsDir = a.entry?.type === "directory" || a.children.size > 0;
    const bIsDir = b.entry?.type === "directory" || b.children.size > 0;

    // Directories first
    if (aIsDir && !bIsDir) return -1;
    if (!aIsDir && bIsDir) return 1;

    // Then alphabetically
    return a.name.localeCompare(b.name);
  });
}

function formatSize(bytes: number): string {
  if (bytes < 1024) return `${bytes}B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)}KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)}MB`;
}

function formatAsciiTree(result: RepoFetchResult, options: OutputOptions): string {
  const tree = buildTree(result.files);
  const lines: string[] = [];

  function renderNode(node: TreeNode, prefix: string, isLast: boolean): void {
    const connector = isLast ? "└── " : "├── ";
    const childPrefix = prefix + (isLast ? "    " : "│   ");

    const isDir = node.entry?.type === "directory" || node.children.size > 0;

    let icon = "";
    if (options.icons) {
      icon = isDir ? "📁 " : "📄 ";
    }

    let suffix = isDir && !options.icons ? "/" : "";

    if (options.showSize && node.entry?.size !== undefined) {
      suffix += ` (${formatSize(node.entry.size)})`;
    }

    lines.push(`${prefix}${connector}${icon}${node.name}${suffix}`);

    const children = sortNodes(Array.from(node.children.values()));
    children.forEach((child, index) => {
      renderNode(child, childPrefix, index === children.length - 1);
    });
  }

  const children = sortNodes(Array.from(tree.children.values()));
  children.forEach((child, index) => {
    renderNode(child, "", index === children.length - 1);
  });

  if (result.truncated) {
    lines.push("");
    lines.push("⚠️  Tree was truncated (repository too large)");
  }

  return lines.join("\n");
}

export function formatContentOutput(result: RepoFetchResult): string {
  const lines: string[] = [];

  for (const file of result.files) {
    if (file.type === "file" && file.content !== undefined) {
      lines.push(`\n${"=".repeat(60)}`);
      lines.push(`FILE: ${file.path}`);
      if (file.size) lines.push(`SIZE: ${formatSize(file.size)}`);
      lines.push("=".repeat(60));
      lines.push(file.content);
    }
  }

  return lines.join("\n");
}

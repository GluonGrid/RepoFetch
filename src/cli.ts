#!/usr/bin/env node

import { repofetch } from "./index.js";
import { formatOutput, formatContentOutput } from "./output.js";
import type { OutputFormat } from "./output.js";
import type { EntryType } from "./types.js";
import fs from "fs";
import path from "path";
import os from "os";
import { execSync } from "child_process";
import { createRequire } from "module";

const require = createRequire(import.meta.url);
const pkg = require("../package.json");

const CONFIG_PATH = path.join(os.homedir(), ".repofetch");

const HELP = `
repofetch - Fetch and explore remote repository structures and contents

Usage:
  repofetch <owner/repo> [options]

Options:
  -b, --branch <name>      Branch to fetch (default: main, falls back to default branch)
  -t, --token <token>      GitHub personal access token
  --save-token <token>     Save token to ~/.repofetch for future use

Filtering:
  -e, --ext <extensions>   Filter by file extensions (comma-separated: .ts,.js)
  --type <type>            Filter by entry type: file, dir, all (default: all)
  --exclude <patterns>     Exclude patterns (comma-separated: node_modules,dist)
  --include <patterns>     Include only matching patterns

Content:
  -c, --content            Fetch file contents (use with --ext or --sha)
  --sha <shas>             Fetch content for specific files by SHA (comma-separated)
  --max-size <bytes>       Max file size to fetch content (default: 1MB)
  --concurrency <n>        Concurrent requests for content (default: 5)

Output:
  -f, --format <format>    Output format: ascii, json, json-pretty, paths (default: ascii)
  --icons                  Show file/folder icons in ascii output
  --size                   Show file sizes in ascii output

Other:
  -v, --version            Show version
  -h, --help               Show this help

Examples:
  repofetch facebook/react
  repofetch microsoft/typescript -b main --ext .ts,.tsx
  repofetch owner/repo --exclude node_modules,dist --format json
  repofetch owner/repo --ext .md --content --format json-pretty
`;

interface Args {
  repo?: string;
  branch?: string;
  token?: string;
  saveToken?: string;
  extensions?: string[];
  exclude?: string[];
  include?: string[];
  type?: EntryType;
  content?: boolean;
  shas?: string[];
  maxSize?: number;
  concurrency?: number;
  format?: OutputFormat;
  icons?: boolean;
  showSize?: boolean;
  help?: boolean;
  version?: boolean;
}

function parseArgs(argv: string[]): Args {
  const args: Args = {};
  let i = 0;

  while (i < argv.length) {
    const arg = argv[i];

    if (arg === "-h" || arg === "--help") {
      args.help = true;
    } else if (arg === "-v" || arg === "--version") {
      args.version = true;
    } else if (arg === "-b" || arg === "--branch") {
      args.branch = argv[++i];
    } else if (arg === "-t" || arg === "--token") {
      args.token = argv[++i];
    } else if (arg === "--save-token") {
      args.saveToken = argv[++i];
    } else if (arg === "-e" || arg === "--ext") {
      args.extensions = argv[++i]?.split(",").map((e) => e.trim());
    } else if (arg === "--exclude") {
      args.exclude = argv[++i]?.split(",").map((e) => e.trim());
    } else if (arg === "--include") {
      args.include = argv[++i]?.split(",").map((e) => e.trim());
    } else if (arg === "--type") {
      args.type = argv[++i] as EntryType;
    } else if (arg === "-c" || arg === "--content") {
      args.content = true;
    } else if (arg === "--sha") {
      args.shas = argv[++i]?.split(",").map((s) => s.trim());
    } else if (arg === "--max-size") {
      args.maxSize = parseInt(argv[++i], 10);
    } else if (arg === "--concurrency") {
      args.concurrency = parseInt(argv[++i], 10);
    } else if (arg === "-f" || arg === "--format") {
      args.format = argv[++i] as OutputFormat;
    } else if (arg === "--icons") {
      args.icons = true;
    } else if (arg === "--size") {
      args.showSize = true;
    } else if (!arg.startsWith("-") && !args.repo) {
      args.repo = arg;
    }

    i++;
  }

  return args;
}

function loadToken(): string | undefined {
  try {
    return fs.readFileSync(CONFIG_PATH, "utf-8").trim();
  } catch {
    return undefined;
  }
}

function saveToken(token: string): void {
  fs.writeFileSync(CONFIG_PATH, token, { mode: 0o600 });
  console.log(`Token saved to ${CONFIG_PATH}`);
}

function copyToClipboard(text: string): boolean {
  try {
    if (process.platform === "darwin") {
      execSync("pbcopy", { input: text });
    } else if (process.platform === "win32") {
      execSync("clip", { input: text });
    } else {
      execSync("xclip -selection clipboard", { input: text });
    }
    return true;
  } catch {
    return false;
  }
}

async function main(): Promise<void> {
  const args = parseArgs(process.argv.slice(2));

  if (args.version) {
    console.log(pkg.version);
    process.exit(0);
  }

  if (args.help || !args.repo) {
    console.log(HELP);
    process.exit(args.help ? 0 : 1);
  }

  if (args.saveToken) {
    saveToken(args.saveToken);
    process.exit(0);
  }

  const token = args.token || loadToken() || process.env.GITHUB_TOKEN;
  const isJsonFormat = args.format === "json" || args.format === "json-pretty";

  if (!isJsonFormat) {
    console.error(`\n📦 Fetching ${args.repo}...`);
  }

  try {
    const result = await repofetch(args.repo, {
      branch: args.branch,
      token,
      extensions: args.extensions,
      exclude: args.exclude,
      include: args.include,
      type: args.type,
      content: args.content,
      shas: args.shas,
      maxFileSize: args.maxSize,
      concurrency: args.concurrency,
    });

    const output = formatOutput(result, {
      format: args.format || "ascii",
      icons: args.icons,
      showSize: args.showSize,
      showContent: args.content,
    });

    console.log(output);

    // For ascii output, also show content separately if fetched
    if (!isJsonFormat && args.content) {
      console.log(formatContentOutput(result));
    }

    // Copy to clipboard for ascii format
    if (!isJsonFormat) {
      if (copyToClipboard(output)) {
        console.error(`\n✨ Tree copied to clipboard!`);
      }
    }
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    if (isJsonFormat) {
      console.log(JSON.stringify({ error: message }));
    } else {
      console.error(`\n❌ Error: ${message}`);
    }
    process.exit(1);
  }
}

main();

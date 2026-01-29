#!/usr/bin/env node

import { program } from "commander";
import { repofetch } from "./index.js";
import { formatOutput, formatContentOutput } from "./output.js";
import type { OutputFormat } from "./output.js";
import type { EntryType, RateLimitInfo } from "./types.js";
import fs from "fs";
import path from "path";
import os from "os";
import { execSync } from "child_process";
import { createRequire } from "module";

const require = createRequire(import.meta.url);
const pkg = require("../package.json");

const CONFIG_PATH = path.join(os.homedir(), ".repofetch");

function loadToken(): string | undefined {
  try {
    return fs.readFileSync(CONFIG_PATH, "utf-8").trim();
  } catch {
    return undefined;
  }
}

function saveToken(token: string): void {
  fs.writeFileSync(CONFIG_PATH, token, { mode: 0o600 });
  console.error(`Token saved to ${CONFIG_PATH}`);
}

function formatRateLimit(rateLimit: RateLimitInfo): string {
  const resetIn = Math.max(
    0,
    Math.ceil((rateLimit.reset.getTime() - Date.now()) / 1000 / 60)
  );
  return `Rate limit: ${rateLimit.remaining}/${rateLimit.limit} remaining (resets in ${resetIn}m)`;
}

function shouldShowRateLimit(
  isAuthenticated: boolean,
  rateLimit: RateLimitInfo | undefined
): boolean {
  if (!rateLimit) return false;

  // Unauthenticated: always show (to encourage adding token)
  if (!isAuthenticated) return true;

  // Authenticated: only show when remaining < 1000 (approaching limit)
  return rateLimit.remaining < 1000;
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

function parseList(value: string): string[] {
  return value.split(",").map((s) => s.trim());
}

program
  .name("repofetch")
  .description("Fetch and explore remote repository structures and contents")
  .version(pkg.version)
  .argument("<repo>", "Repository in owner/repo format")
  // Options
  .option("-b, --branch <name>", "Branch to fetch (default: main)")
  .option("-t, --token <token>", "GitHub personal access token")
  .option("--save-token <token>", "Save token to ~/.repofetch for future use")
  // Filtering
  .option("-e, --ext <extensions>", "Filter by file extensions (comma-separated)", parseList)
  .option("--type <type>", "Filter by entry type: file, dir, all", "all")
  .option("--exclude <patterns>", "Exclude patterns (comma-separated)", parseList)
  .option("--include <patterns>", "Include only matching patterns", parseList)
  // Content
  .option("-c, --content", "Fetch file contents")
  .option("--sha <shas>", "Fetch content for specific files by SHA (comma-separated)", parseList)
  .option("--max-size <bytes>", "Max file size to fetch content (default: 1MB)", parseInt)
  .option("--concurrency <n>", "Concurrent requests for content (default: 5)", parseInt)
  // Output
  .option("-f, --format <format>", "Output format: ascii, json, json-pretty, paths", "ascii")
  .option("--icons", "Show file/folder icons in ascii output")
  .option("--size", "Show file sizes in ascii output")
  .action(async (repo: string, options) => {
    // Save token if provided
    if (options.saveToken) {
      saveToken(options.saveToken);
    }

    const token =
      options.saveToken || options.token || loadToken() || process.env.GITHUB_TOKEN;
    const isJsonFormat = options.format === "json" || options.format === "json-pretty";

    if (!isJsonFormat) {
      console.error(`\n📦 Fetching ${repo}...`);
    }

    try {
      const result = await repofetch(repo, {
        branch: options.branch,
        token,
        extensions: options.ext,
        exclude: options.exclude,
        include: options.include,
        type: options.type as EntryType,
        content: options.content,
        shas: options.sha,
        maxFileSize: options.maxSize,
        concurrency: options.concurrency,
      });

      const output = formatOutput(result, {
        format: options.format as OutputFormat,
        icons: options.icons,
        showSize: options.size,
        showContent: options.content,
      });

      console.log(output);

      // For ascii output, also show content separately if fetched
      if (!isJsonFormat && options.content) {
        console.log(formatContentOutput(result));
      }

      // Copy to clipboard for ascii format
      if (!isJsonFormat) {
        if (copyToClipboard(output)) {
          console.error(`\n✨ Tree copied to clipboard!`);
        }

        // Show rate limit info
        if (shouldShowRateLimit(result.isAuthenticated ?? false, result.rateLimit)) {
          if (result.rateLimit) {
            const rateLimitMsg = formatRateLimit(result.rateLimit);
            if (!result.isAuthenticated) {
              console.error(`\n⚠️  ${rateLimitMsg}`);
              console.error(
                `   Tip: Use --token or --save-token to increase limit to 5000/hour`
              );
            } else {
              console.error(`\n⚠️  ${rateLimitMsg}`);
            }
          }
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
  });

program.parse();

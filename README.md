<div align="center">

# RepoFetch 🌸

**Fetch and explore remote repository structures and file contents without cloning**

Built for AI agents and developers who need quick access to repository layouts and contents.

[![npm version](https://img.shields.io/npm/v/repofetch.svg)](https://www.npmjs.com/package/repofetch)
[![npm downloads](https://img.shields.io/npm/dm/repofetch.svg)](https://www.npmjs.com/package/repofetch)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)
[![Node.js](https://img.shields.io/badge/node-%3E%3D18.0.0-brightgreen.svg)](https://nodejs.org/)

</div>

---

## Installation

```bash
npm install -g repofetch
```

Or use directly with npx:

```bash
npx repofetch facebook/react
```

## Features

- View repository tree structure as ASCII art or JSON
- Filter by file extensions
- Exclude/include patterns
- Fetch file contents directly via GitHub API
- Fetch specific files by SHA (useful for AI agent workflows)
- Supports private repositories with GitHub token authentication

## Usage

```bash
repofetch <owner/repo> [options]
```

### Basic Examples

```bash
# View full tree
repofetch facebook/react

# Filter by extension
repofetch microsoft/typescript --ext .ts,.tsx

# Exclude patterns
repofetch owner/repo --exclude node_modules,dist,__tests__

# View only files (no directories)
repofetch owner/repo --type file

# View only directories
repofetch owner/repo --type dir

# JSON output (ideal for AI agents)
repofetch owner/repo --format json-pretty
```

### Fetching File Contents

```bash
# Fetch content of all markdown files
repofetch owner/repo --ext .md --content

# Fetch specific files by SHA (from a previous run)
repofetch owner/repo --sha abc123,def456 --content --format json
```

### AI Agent Workflow

1. **Discover files** - Get the tree structure with metadata:

   ```bash
   repofetch owner/repo --ext .ts --format json
   ```

2. **Review output** - Each file includes its SHA:

   ```json
   {
     "path": "src/index.ts",
     "type": "file",
     "sha": "abc123def456...",
     "size": 1234,
     "extension": ".ts"
   }
   ```

3. **Fetch specific files** - Use SHA to get only the files you need:

   ```bash
   repofetch owner/repo --sha abc123,def456 --content --format json
   ```

## Options

### General

| Flag | Description |
|------|-------------|
| `-b, --branch <name>` | Branch to fetch (default: main, falls back to default branch) |
| `-t, --token <token>` | GitHub personal access token |
| `--save-token <token>` | Save token to ~/.repofetch for future use |

### Filtering

| Flag | Description |
|------|-------------|
| `-e, --ext <extensions>` | Filter by file extensions (comma-separated: `.ts,.js`) |
| `--type <type>` | Filter by entry type: `file`, `dir`, `all` (default: `all`) |
| `--exclude <patterns>` | Exclude patterns (comma-separated: `node_modules,dist`) |
| `--include <patterns>` | Include only matching patterns |

### Content

| Flag | Description |
|------|-------------|
| `-c, --content` | Fetch file contents |
| `--sha <shas>` | Fetch content for specific files by SHA (comma-separated) |
| `--max-size <bytes>` | Max file size to fetch content (default: 1MB) |
| `--concurrency <n>` | Concurrent requests for content (default: 5) |

### Output

| Flag | Description |
|------|-------------|
| `-f, --format <format>` | Output format: `ascii`, `json`, `json-pretty`, `paths` (default: `ascii`) |
| `--icons` | Show file/folder icons in ASCII output |
| `--size` | Show file sizes in ASCII output |

## Authentication

For private repositories or to avoid rate limits, use a GitHub personal access token:

```bash
# Use once
repofetch owner/private-repo --token ghp_xxxx

# Save for future use
repofetch --save-token ghp_xxxx
repofetch owner/private-repo  # Token loaded automatically

# Or use environment variable
export GITHUB_TOKEN=ghp_xxxx
repofetch owner/private-repo
```

## Output Formats

### ASCII (default)

```
├── src/
│   ├── index.ts
│   └── utils/
│       └── helpers.ts
├── package.json
└── README.md
```

### JSON

```json
{
  "repo": "owner/repo",
  "branch": "main",
  "truncated": false,
  "files": [
    {
      "path": "src/index.ts",
      "type": "file",
      "sha": "abc123...",
      "size": 1234,
      "extension": ".ts"
    }
  ]
}
```

### Paths

```
src/index.ts
src/utils/helpers.ts
package.json
README.md
```

## Programmatic Usage

```typescript
import { repofetch } from 'repofetch';

const result = await repofetch('facebook/react', {
  branch: 'main',
  extensions: ['.ts', '.tsx'],
  exclude: ['node_modules', '__tests__'],
  content: true,
});

console.log(result.files);
```

### TypeScript Types

```typescript
import type { RepoFetchResult, RepoFetchOptions, FileEntry } from 'repofetch';
```

## Roadmap

Future features under consideration:

### Rate Limit Handling

- [ ] **Smart rate limiting** - Monitor `x-ratelimit-remaining` headers and auto-throttle requests
- [ ] **Rate limit warnings** - Warn users when approaching limits, suggest authentication
- [ ] **Auto-detect GitHub token** - Check `gh auth token`, git credentials, or `~/.config/gh/hosts.yml`
- [ ] **Retry with backoff** - Automatic retry with exponential backoff on 429/403 responses
- [ ] **Concurrent request handling** - Respect GitHub's 100 concurrent request limit for multi-agent scenarios

### Additional Providers

- [ ] **GitLab support** - `repofetch gitlab:owner/repo` or `repofetch --provider gitlab owner/repo`
- [ ] **Bitbucket support** - `repofetch bitbucket:owner/repo`
- [ ] **Gitea/Forgejo support** - Self-hosted Git platforms
- [ ] **Azure DevOps support** - `repofetch azure:org/project/repo`

### Enhanced Features

- [ ] **File descriptions** - AI-generated summaries of file contents
- [ ] **Search within tree** - Filter by filename patterns (`--name "*.test.*"`)
- [ ] **Diff between branches** - `repofetch owner/repo --diff main..feature`
- [ ] **Output to file** - `repofetch owner/repo -o tree.json`
- [ ] **Cache layer** - Local caching to reduce API calls

Contributions welcome! Feel free to open an issue or PR.

## Acknowledgements

This project was inspired by [GitHubTree](https://github.com/mgks/GitHubTree) by [@mgks](https://github.com/mgks). Thank you for the original idea and implementation!

## License

MIT

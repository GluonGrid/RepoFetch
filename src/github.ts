import type { TreeResponse, BlobResponse } from "./types.js";

const API_BASE = "https://api.github.com";

export class GitHubClient {
  private token?: string;
  private headers: Record<string, string>;

  constructor(token?: string) {
    this.token = token;
    this.headers = {
      Accept: "application/vnd.github.v3+json",
      "User-Agent": "gtree-cli",
    };
    if (token) {
      this.headers["Authorization"] = `Bearer ${token}`;
    }
  }

  async getDefaultBranch(repo: string): Promise<string> {
    const res = await fetch(`${API_BASE}/repos/${repo}`, {
      headers: this.headers,
    });

    if (!res.ok) {
      if (res.status === 404) {
        throw new Error(`Repository "${repo}" not found or is private`);
      }
      if (res.status === 403) {
        throw new Error("GitHub API rate limit exceeded. Use --token to authenticate");
      }
      throw new Error(`GitHub API error: ${res.status} ${res.statusText}`);
    }

    const data = await res.json();
    return data.default_branch;
  }

  async getTree(repo: string, branch: string): Promise<{ tree: TreeResponse; branch: string }> {
    // First, get the commit SHA for the branch
    let targetBranch = branch;
    let res = await fetch(`${API_BASE}/repos/${repo}/commits/${targetBranch}`, {
      headers: this.headers,
    });

    // If branch not found, try default branch
    if (!res.ok && (res.status === 404 || res.status === 422)) {
      targetBranch = await this.getDefaultBranch(repo);
      res = await fetch(`${API_BASE}/repos/${repo}/commits/${targetBranch}`, {
        headers: this.headers,
      });
    }

    if (!res.ok) {
      if (res.status === 403) {
        throw new Error("GitHub API rate limit exceeded. Use --token to authenticate");
      }
      throw new Error(`Failed to get commit: ${res.status} ${res.statusText}`);
    }

    const commitData = await res.json();
    const treeSha = commitData.commit.tree.sha;

    // Now get the full tree recursively
    const treeRes = await fetch(
      `${API_BASE}/repos/${repo}/git/trees/${treeSha}?recursive=1`,
      { headers: this.headers }
    );

    if (!treeRes.ok) {
      throw new Error(`Failed to get tree: ${treeRes.status} ${treeRes.statusText}`);
    }

    const tree: TreeResponse = await treeRes.json();
    return { tree, branch: targetBranch };
  }

  async getBlob(repo: string, sha: string): Promise<BlobResponse> {
    const res = await fetch(`${API_BASE}/repos/${repo}/git/blobs/${sha}`, {
      headers: this.headers,
    });

    if (!res.ok) {
      throw new Error(`Failed to get blob: ${res.status} ${res.statusText}`);
    }

    return res.json();
  }

  async getBlobContent(repo: string, sha: string): Promise<string> {
    const blob = await this.getBlob(repo, sha);
    return Buffer.from(blob.content, "base64").toString("utf-8");
  }
}

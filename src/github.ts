import type { TreeResponse, BlobResponse, RateLimitInfo } from "./types.js";

const API_BASE = "https://api.github.com";

export class GitHubClient {
  private token?: string;
  private headers: Record<string, string>;
  private _rateLimit: RateLimitInfo | null = null;

  constructor(token?: string) {
    this.token = token;
    this.headers = {
      Accept: "application/vnd.github.v3+json",
      "User-Agent": "repofetch-cli",
    };
    if (token) {
      this.headers["Authorization"] = `Bearer ${token}`;
    }
  }

  get isAuthenticated(): boolean {
    return !!this.token;
  }

  get rateLimit(): RateLimitInfo | null {
    return this._rateLimit;
  }

  private updateRateLimit(res: Response): void {
    const limit = res.headers.get("X-RateLimit-Limit");
    const remaining = res.headers.get("X-RateLimit-Remaining");
    const used = res.headers.get("X-RateLimit-Used");
    const reset = res.headers.get("X-RateLimit-Reset");

    if (limit && remaining && used && reset) {
      this._rateLimit = {
        limit: parseInt(limit, 10),
        remaining: parseInt(remaining, 10),
        used: parseInt(used, 10),
        reset: new Date(parseInt(reset, 10) * 1000),
      };
    }
  }

  async getDefaultBranch(repo: string): Promise<string> {
    const res = await fetch(`${API_BASE}/repos/${repo}`, {
      headers: this.headers,
    });
    this.updateRateLimit(res);

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
    this.updateRateLimit(res);

    // If branch not found, try default branch
    if (!res.ok && (res.status === 404 || res.status === 422)) {
      targetBranch = await this.getDefaultBranch(repo);
      res = await fetch(`${API_BASE}/repos/${repo}/commits/${targetBranch}`, {
        headers: this.headers,
      });
      this.updateRateLimit(res);
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
    this.updateRateLimit(treeRes);

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
    this.updateRateLimit(res);

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

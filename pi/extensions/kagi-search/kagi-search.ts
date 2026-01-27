import type { ExtensionAPI } from "@mariozechner/pi-coding-agent";
import { Type } from "@sinclair/typebox";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { homedir } from "node:os";
import { join } from "node:path";
import { execSync } from "node:child_process";

interface SearchResult {
  title: string;
  url: string;
  snippet: string;
}

interface QuickAnswer {
  markdown: string;
  references: { title: string; url: string; contribution: string }[];
}

interface KagiConfig {
  password_command?: string;
  timeout?: number;
}

function loadConfig(): KagiConfig {
  const configPath = join(homedir(), ".config", "kagi", "config.json");

  if (!existsSync(configPath)) {
    const defaultConfig: KagiConfig = {
      password_command: "rbw get kagi-session-link",
      timeout: 30,
    };
    mkdirSync(join(homedir(), ".config", "kagi"), { recursive: true });
    writeFileSync(configPath, JSON.stringify(defaultConfig, null, 2));
    return defaultConfig;
  }

  return JSON.parse(readFileSync(configPath, "utf-8"));
}

function getSessionToken(config: KagiConfig): string {
  const cmd = config.password_command ?? "rbw get kagi-session-link";
  const output = execSync(cmd, { encoding: "utf-8" }).trim();

  if (output.includes("token=")) {
    return output.split("token=")[1].split("&")[0];
  }
  return output;
}

class KagiClient {
  private cookies: string[] = [];
  private sessionCookie = "";
  private userAgent = "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36";

  async authenticate(token: string): Promise<void> {
    const tokenUrl = `https://kagi.com/html/search?token=${token}`;

    const response = await fetch(tokenUrl, {
      headers: { "User-Agent": this.userAgent },
      redirect: "manual",
    });

    // Collect cookies from response
    const setCookies = response.headers.getSetCookie();
    this.cookies = setCookies.map((c) => c.split(";")[0]);

    // Extract kagi_session for authorization header
    for (const cookie of this.cookies) {
      if (cookie.startsWith("kagi_session=")) {
        this.sessionCookie = cookie.split("=")[1];
        break;
      }
    }

    // Follow redirect if needed
    if (response.status >= 300 && response.status < 400) {
      const location = response.headers.get("location");
      if (location?.includes("/signin") || location?.includes("/welcome")) {
        throw new Error("Authentication failed");
      }
    }
  }

  async search(query: string, limit = 10): Promise<SearchResult[]> {
    const url = `https://kagi.com/html/search?q=${encodeURIComponent(query)}`;

    const response = await fetch(url, {
      headers: {
        "User-Agent": this.userAgent,
        Cookie: this.cookies.join("; "),
        Accept: "text/html",
      },
    });

    const html = await response.text();
    const results: SearchResult[] = [];

    // Parse search results using regex (simple HTML parsing)
    const resultPattern =
      /<div[^>]*class="[^"]*search-result[^"]*"[^>]*>([\s\S]*?)<\/div>\s*<\/div>\s*<\/div>/g;
    const titlePattern =
      /<a[^>]*class="[^"]*__sri-title[^"]*"[^>]*>([\s\S]*?)<\/a>/;
    const urlPattern =
      /<a[^>]*class="[^"]*__sri-url[^"]*"[^>]*href="([^"]*)"[^>]*>/;
    const snippetPattern =
      /<div[^>]*class="[^"]*__sri-desc[^"]*"[^>]*>([\s\S]*?)<\/div>/;

    let match;
    while (
      (match = resultPattern.exec(html)) !== null && results.length < limit
    ) {
      const block = match[1];

      const titleMatch = titlePattern.exec(block);
      const urlMatch = urlPattern.exec(block);
      const snippetMatch = snippetPattern.exec(block);

      if (titleMatch && urlMatch) {
        results.push({
          title: titleMatch[1].replace(/<[^>]*>/g, "").trim(),
          url: urlMatch[1],
          snippet: snippetMatch
            ? snippetMatch[1].replace(/<[^>]*>/g, "").trim()
            : "",
        });
      }
    }

    return results;
  }

  async getQuickAnswer(query: string): Promise<QuickAnswer | null> {
    const url = `https://kagi.com/mother/context?q=${
      encodeURIComponent(query)
    }`;

    try {
      const response = await fetch(url, {
        method: "POST",
        headers: {
          "User-Agent": this.userAgent,
          Cookie: this.cookies.join("; "),
          Accept: "application/vnd.kagi.stream",
          "X-Kagi-Authorization": this.sessionCookie,
          "Content-Length": "0",
          Origin: "https://kagi.com",
          Referer: `https://kagi.com/search?q=${encodeURIComponent(query)}`,
        },
      });

      const text = await response.text();
      const lines = text.split("\n");

      for (const line of lines) {
        if (line.startsWith("new_message.json:")) {
          const json = line.slice("new_message.json:".length);
          const data = JSON.parse(json);

          const markdown = data.md || "";
          const referencesMd = data.references_md || "";

          // Parse references
          const references: QuickAnswer["references"] = [];
          const refPattern = /\[\^\d+\]:\s*\[([^\]]+)\]\((.+?)\)\s*\((\d+)%\)/g;
          let refMatch;
          while ((refMatch = refPattern.exec(referencesMd)) !== null) {
            references.push({
              title: refMatch[1],
              url: refMatch[2],
              contribution: `${refMatch[3]}%`,
            });
          }

          if (markdown) {
            return { markdown, references };
          }
        }
      }
    } catch {
      return null;
    }

    return null;
  }
}

export default function (pi: ExtensionAPI) {
  let client: KagiClient | null = null;

  async function ensureClient(): Promise<KagiClient> {
    if (!client) {
      client = new KagiClient();
      const config = loadConfig();
      const token = getSessionToken(config);
      await client.authenticate(token);
    }
    return client;
  }

  pi.registerTool({
    name: "kagi_search",
    description:
      "Search the web using Kagi. Returns search results and optionally a Quick Answer summary.",
    parameters: Type.Object({
      query: Type.String({ description: "Search query" }),
      limit: Type.Optional(
        Type.Number({ description: "Max results (default 10)" }),
      ),
      quick_answer: Type.Optional(
        Type.Boolean({
          description: "Include Quick Answer if available (default true)",
        }),
      ),
    }),
    async execute(toolCallId, params, onUpdate, ctx, signal) {
      try {
        const kagi = await ensureClient();
        const limit = params.limit ?? 10;
        const includeQuickAnswer = params.quick_answer ?? true;

        const [results, quickAnswer] = await Promise.all([
          kagi.search(params.query, limit),
          includeQuickAnswer ? kagi.getQuickAnswer(params.query) : null,
        ]);

        let output = "";

        if (quickAnswer) {
          output += "## Quick Answer\n\n";
          output += quickAnswer.markdown + "\n\n";
          if (quickAnswer.references.length > 0) {
            output += "### References\n";
            for (const ref of quickAnswer.references) {
              output += `- [${ref.title}](${ref.url}) (${ref.contribution})\n`;
            }
            output += "\n";
          }
        }

        output += "## Search Results\n\n";
        for (let i = 0; i < results.length; i++) {
          const r = results[i];
          output += `${i + 1}. **[${r.title}](${r.url})**\n`;
          if (r.snippet) {
            output += `   ${r.snippet}\n`;
          }
          output += "\n";
        }

        return { content: [{ type: "text", text: output }] };
      } catch (e) {
        client = null; // Reset client on error
        const msg = e instanceof Error ? e.message : String(e);
        return {
          content: [{ type: "text", text: `Kagi search failed: ${msg}` }],
          isError: true,
        };
      }
    },
  });
}

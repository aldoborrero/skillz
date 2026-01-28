/**
 * ast-grep Extension
 *
 * Structural code search using AST patterns. More powerful than text search
 * because it understands code structure.
 *
 * Examples:
 *   - Find all function calls: `$FUNC($$$ARGS)`
 *   - Find console.log: `console.log($$$)`
 *   - Find React useState: `const [$STATE, $SETTER] = useState($INIT)`
 *
 * Requires: ast-grep installed (https://ast-grep.github.io)
 */

import type { ExtensionAPI } from "@mariozechner/pi-coding-agent";
import { Type } from "@sinclair/typebox";
import { spawn } from "node:child_process";

interface AstGrepMatch {
  file: string;
  range: {
    byteOffset: { start: number; end: number };
    start: { line: number; column: number };
    end: { line: number; column: number };
  };
  lines: string;
  text: string;
  replacement?: string;
  language: string;
  metaVariables?: Record<string, { text: string }>;
}

function runAstGrep(args: string[], cwd: string): Promise<AstGrepMatch[]> {
  return new Promise((resolve, reject) => {
    const child = spawn("ast-grep", args, {
      cwd,
      stdio: ["pipe", "pipe", "pipe"],
    });

    let stdout = "";
    let stderr = "";

    child.stdout.on("data", (chunk) => {
      stdout += chunk.toString();
    });

    child.stderr.on("data", (chunk) => {
      stderr += chunk.toString();
    });

    child.on("close", (code) => {
      // ast-grep returns 0 for matches, 1 for no matches
      if (code !== 0 && code !== 1) {
        reject(new Error(stderr || `ast-grep exited with code ${code}`));
        return;
      }

      if (!stdout.trim()) {
        resolve([]);
        return;
      }

      try {
        const results = JSON.parse(stdout) as AstGrepMatch[];
        resolve(results);
      } catch {
        reject(new Error(`Failed to parse ast-grep output: ${stdout}`));
      }
    });

    child.on("error", (err) => {
      if ((err as NodeJS.ErrnoException).code === "ENOENT") {
        reject(new Error("ast-grep not found. Install from https://ast-grep.github.io"));
      } else {
        reject(err);
      }
    });
  });
}

function formatResults(matches: AstGrepMatch[], showContext: boolean): string {
  if (matches.length === 0) {
    return "No matches found.";
  }

  // Group by file
  const byFile = new Map<string, AstGrepMatch[]>();
  for (const match of matches) {
    const existing = byFile.get(match.file) || [];
    existing.push(match);
    byFile.set(match.file, existing);
  }

  let output = `Found ${matches.length} match(es) in ${byFile.size} file(s):\n\n`;

  for (const [file, fileMatches] of byFile) {
    output += `### ${file}\n\n`;

    for (const match of fileMatches) {
      const loc = `${match.range.start.line}:${match.range.start.column}`;
      output += `**Line ${loc}**\n`;

      if (showContext) {
        output += "```\n" + match.lines.trimEnd() + "\n```\n";
      } else {
        output += "```\n" + match.text + "\n```\n";
      }

      // Show captured metavariables if any
      if (match.metaVariables && Object.keys(match.metaVariables).length > 0) {
        output += "Captures: ";
        const captures = Object.entries(match.metaVariables)
          .map(([k, v]) => `${k}=\`${v.text}\``)
          .join(", ");
        output += captures + "\n";
      }

      output += "\n";
    }
  }

  return output.trim();
}

export default function (pi: ExtensionAPI) {
  pi.registerTool({
    name: "ast_grep",
    description: `Search code using AST patterns with ast-grep. More powerful than text search because it understands code structure.

Pattern syntax:
- $NAME matches any single AST node and captures it
- $$$NAME matches zero or more nodes (spread)
- Literal code matches exactly

Examples:
- \`console.log($MSG)\` - find console.log calls
- \`function $NAME($$$ARGS) { $$$BODY }\` - find function declarations
- \`if ($COND) { $$$THEN }\` - find if statements
- \`import $NAME from '$PATH'\` - find imports

Languages: javascript, typescript, python, rust, go, java, c, cpp, etc.`,
    parameters: Type.Object({
      pattern: Type.String({
        description: "AST pattern to search for. Use $VAR for wildcards, $$$ for spread.",
      }),
      lang: Type.Optional(
        Type.String({
          description: "Language (e.g., typescript, python, rust). Auto-detected if not specified.",
        }),
      ),
      paths: Type.Optional(
        Type.Array(Type.String(), {
          description: "Paths to search (default: current directory)",
        }),
      ),
      globs: Type.Optional(
        Type.Array(Type.String(), {
          description: "Glob patterns to include/exclude (e.g., '*.ts', '!node_modules')",
        }),
      ),
      context: Type.Optional(
        Type.Boolean({
          description: "Show surrounding context lines (default: false)",
        }),
      ),
      limit: Type.Optional(
        Type.Number({
          description: "Maximum number of matches to return (default: 50)",
        }),
      ),
    }),
    async execute(_toolCallId, params, onUpdate, ctx, _signal) {
      try {
        const args: string[] = ["run", "--pattern", params.pattern, "--json=compact"];

        if (params.lang) {
          args.push("--lang", params.lang);
        }

        if (params.globs) {
          for (const glob of params.globs) {
            args.push("--globs", glob);
          }
        }

        if (params.context) {
          args.push("--context", "2");
        }

        // Add paths or use current directory
        if (params.paths && params.paths.length > 0) {
          args.push(...params.paths);
        } else {
          args.push(".");
        }

        onUpdate?.({
          content: [{ type: "text", text: `Searching for pattern: ${params.pattern}...` }],
        });

        let matches = await runAstGrep(args, ctx.cwd);

        // Apply limit
        const limit = params.limit ?? 50;
        if (matches.length > limit) {
          matches = matches.slice(0, limit);
        }

        const output = formatResults(matches, params.context ?? false);

        return { content: [{ type: "text", text: output }] };
      } catch (e) {
        const msg = e instanceof Error ? e.message : String(e);
        return {
          content: [{ type: "text", text: `ast-grep search failed: ${msg}` }],
          isError: true,
        };
      }
    },
  });
}

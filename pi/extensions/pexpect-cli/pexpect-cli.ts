import type { ExtensionAPI } from "@mariozechner/pi-coding-agent";
import { Type } from "@sinclair/typebox";
import { execSync, spawn } from "node:child_process";

// Types
interface Session {
	id: string;
	status: string;
	name?: string;
}

// Helper: Parse output from `pexpect-cli --list`
// Format: "session_id: status (optional_name)" or "session_id: status"
function parseSessionList(output: string): Session[] {
	const sessions: Session[] = [];
	const lines = output.trim().split("\n");

	for (const line of lines) {
		if (!line.trim()) continue;

		// Match: "abc12345: Running (my-session)" or "abc12345: Running"
		const match = line.match(/^([a-f0-9]+):\s*(\w+)(?:\s*\(([^)]+)\))?/i);
		if (match) {
			sessions.push({
				id: match[1],
				status: match[2],
				name: match[3],
			});
		}
	}

	return sessions;
}

// Helper: Check if pueue daemon is running, provide helpful error if not
function ensurePueueRunning(): void {
	try {
		execSync("pueue status", { encoding: "utf-8", stdio: "pipe" });
	} catch {
		throw new Error(
			"pueue daemon is not running. Start it with: pueued -d",
		);
	}
}

// Helper: Execute pexpect-cli command and return output
function runPexpectCli(args: string[]): string {
	try {
		return execSync(`pexpect-cli ${args.join(" ")}`, {
			encoding: "utf-8",
			stdio: ["pipe", "pipe", "pipe"],
		}).trim();
	} catch (e) {
		if (e instanceof Error && "stderr" in e) {
			throw new Error((e as { stderr: string }).stderr || e.message);
		}
		throw e;
	}
}

// Helper: Execute code in a session using stdin
function execInSession(
	sessionId: string,
	code: string,
	timeout?: number,
): Promise<string> {
	return new Promise((resolve, reject) => {
		const child = spawn("pexpect-cli", [sessionId], {
			stdio: ["pipe", "pipe", "pipe"],
		});

		let stdout = "";
		let stderr = "";
		let timeoutId: NodeJS.Timeout | undefined;

		if (timeout) {
			timeoutId = setTimeout(() => {
				child.kill("SIGTERM");
				reject(new Error(`Execution timed out after ${timeout}ms`));
			}, timeout);
		}

		child.stdout.on("data", (chunk) => {
			stdout += chunk.toString();
		});

		child.stderr.on("data", (chunk) => {
			stderr += chunk.toString();
		});

		child.on("close", (code) => {
			if (timeoutId) clearTimeout(timeoutId);

			if (code !== 0 && stderr) {
				reject(new Error(stderr));
			} else {
				resolve(stdout);
			}
		});

		child.on("error", (err) => {
			if (timeoutId) clearTimeout(timeoutId);
			reject(err);
		});

		// Write code to stdin and close
		child.stdin.write(code);
		child.stdin.end();
	});
}

export default function (pi: ExtensionAPI) {
	// Tool 1: pexpect_start
	pi.registerTool({
		name: "pexpect_start",
		description:
			"Start a new pexpect session for automating interactive CLI programs (SSH, databases, editors, interactive shells). Returns a session ID for subsequent commands. Sessions run as pueue tasks and persist until explicitly stopped.",
		parameters: Type.Object({
			name: Type.Optional(
				Type.String({
					description:
						"Optional label to identify the session (e.g., 'ssh-prod', 'db-session')",
				}),
			),
		}),
		async execute(_toolCallId, params, _onUpdate, _ctx, _signal) {
			try {
				ensurePueueRunning();

				const args = ["--start"];
				if (params.name) {
					args.push("--name", params.name);
				}

				const sessionId = runPexpectCli(args);

				const message = params.name
					? `Started session \`${sessionId}\` (${params.name})`
					: `Started session \`${sessionId}\``;

				return {
					content: [{ type: "text", text: message }],
				};
			} catch (e) {
				const msg = e instanceof Error ? e.message : String(e);
				return {
					content: [
						{ type: "text", text: `Failed to start session: ${msg}` },
					],
					isError: true,
				};
			}
		},
	});

	// Tool 2: pexpect_exec
	pi.registerTool({
		name: "pexpect_exec",
		description: `Execute Python/pexpect code in an existing session. The \`pexpect\` module is pre-imported and a \`child\` variable persists across executions.

Common patterns:
- Spawn process: \`child = pexpect.spawn('ssh user@host')\`
- Wait for prompt: \`child.expect('password:')\`
- Send input: \`child.sendline('mypassword')\`
- Get output: \`print(child.before.decode())\`

Use print() to return output to the agent.`,
		parameters: Type.Object({
			session_id: Type.String({
				description: "The 8-character hex session ID from pexpect_start",
			}),
			code: Type.String({
				description:
					"Python code to execute. The pexpect module and child variable are available.",
			}),
			timeout: Type.Optional(
				Type.Number({
					description:
						"Execution timeout in milliseconds (default: no timeout)",
				}),
			),
		}),
		async execute(_toolCallId, params, onUpdate, _ctx, _signal) {
			try {
				ensurePueueRunning();

				// Verify session exists
				const listOutput = runPexpectCli(["--list"]);
				const sessions = parseSessionList(listOutput);
				const session = sessions.find((s) => s.id === params.session_id);

				if (!session) {
					return {
						content: [
							{
								type: "text",
								text: `Session \`${params.session_id}\` not found. Use pexpect_list to see active sessions.`,
							},
						],
						isError: true,
					};
				}

				// Show execution in progress
				onUpdate?.({
					content: [
						{
							type: "text",
							text: `Executing in session \`${params.session_id}\`...`,
						},
					],
				});

				const output = await execInSession(
					params.session_id,
					params.code,
					params.timeout,
				);

				const result = output.trim() || "(no output)";

				return {
					content: [{ type: "text", text: result }],
				};
			} catch (e) {
				const msg = e instanceof Error ? e.message : String(e);
				return {
					content: [{ type: "text", text: `Execution failed: ${msg}` }],
					isError: true,
				};
			}
		},
	});

	// Tool 3: pexpect_stop
	pi.registerTool({
		name: "pexpect_stop",
		description:
			"Stop a pexpect session and clean up resources. The session's pueue task will be terminated.",
		parameters: Type.Object({
			session_id: Type.String({
				description: "The 8-character hex session ID to stop",
			}),
		}),
		async execute(_toolCallId, params, _onUpdate, _ctx, _signal) {
			try {
				ensurePueueRunning();

				// Verify session exists
				const listOutput = runPexpectCli(["--list"]);
				const sessions = parseSessionList(listOutput);
				const session = sessions.find((s) => s.id === params.session_id);

				if (!session) {
					return {
						content: [
							{
								type: "text",
								text: `Session \`${params.session_id}\` not found or already stopped.`,
							},
						],
					};
				}

				runPexpectCli(["--stop", params.session_id]);

				const message = session.name
					? `Stopped session \`${params.session_id}\` (${session.name})`
					: `Stopped session \`${params.session_id}\``;

				return {
					content: [{ type: "text", text: message }],
				};
			} catch (e) {
				const msg = e instanceof Error ? e.message : String(e);
				return {
					content: [{ type: "text", text: `Failed to stop session: ${msg}` }],
					isError: true,
				};
			}
		},
	});

	// Tool 4: pexpect_list
	pi.registerTool({
		name: "pexpect_list",
		description:
			"List all active pexpect sessions managed by pueue. Shows session IDs, status, and optional names.",
		parameters: Type.Object({}),
		async execute(_toolCallId, _params, _onUpdate, _ctx, _signal) {
			try {
				ensurePueueRunning();

				const listOutput = runPexpectCli(["--list"]);
				const sessions = parseSessionList(listOutput);

				if (sessions.length === 0) {
					return {
						content: [
							{
								type: "text",
								text: "No active pexpect sessions. Use pexpect_start to create one.",
							},
						],
					};
				}

				let output = "Active pexpect sessions:\n\n";
				for (const session of sessions) {
					if (session.name) {
						output += `- \`${session.id}\`: ${session.status} (${session.name})\n`;
					} else {
						output += `- \`${session.id}\`: ${session.status}\n`;
					}
				}

				return {
					content: [{ type: "text", text: output.trim() }],
				};
			} catch (e) {
				const msg = e instanceof Error ? e.message : String(e);
				return {
					content: [
						{ type: "text", text: `Failed to list sessions: ${msg}` },
					],
					isError: true,
				};
			}
		},
	});
}

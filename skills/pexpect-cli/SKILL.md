---
name: pexpect-cli
description: Automate interactive CLI programs with persistent sessions using pexpect-cli and pueue. Use when needing to automate programs that require interactive input/output (SSH sessions, database CLIs, vim/editors, interactive shells, or any program with prompts). Provides session management, real-time monitoring, and persistent state across multiple commands.
---

# pexpect-cli

Automate interactive CLI programs with persistent pexpect sessions managed by pueue.

## Core Concepts

**pexpect-cli** enables automation of interactive command-line programs through:

- **Persistent sessions**: Maintain long-running interactive processes with preserved state
- **Session management**: Create, execute, monitor, and stop sessions with unique IDs
- **Built-in monitoring**: Leverage pueue for logging and status tracking
- **Real-time output**: Stream output to pueue logs as commands execute

**Architecture**: Sessions run as pueue tasks in the `pexpect` group. Each session has:
- A unique 8-character hex session ID (e.g., `5901c22d`)
- A pueue task ID (different from session ID, shown in `pueue status`)
- A Unix socket for client-server communication
- A persistent Python namespace with `pexpect` module and `child` variable

## Quick Start

Start a session, execute pexpect code via stdin, monitor with pueue:

```bash
# Start session
session=$(pexpect-cli --start --name my-session)

# Execute code
pexpect-cli $session <<'EOF'
child = pexpect.spawn('bash')
child.sendline('echo "Hello World"')
child.expect('\$')
print(child.before.decode())
EOF

# Monitor (get task ID from pueue status --group pexpect)
pueue follow <task-id>

# Stop when done
pexpect-cli --stop $session
```

## Session Management

### Start Sessions

```bash
# Basic start (returns session ID)
pexpect-cli --start
# Returns: 5901c22d

# With label for easy identification
pexpect-cli --start --name ssh-prod
# Returns: a3f4b2c1
```

### Execute Code

Pass Python code via stdin. Available in namespace: `pexpect` module and `child` variable (persists across executions).

```bash
# Using echo
echo 'child = pexpect.spawn("bash")' | pexpect-cli $session

# Using heredoc
pexpect-cli $session <<'EOF'
child.sendline('pwd')
child.expect('\$')
print(child.before.decode())
EOF

# From file
pexpect-cli $session < automation_script.py
```

### Monitor Sessions

```bash
# List all pexpect sessions
pueue status --group pexpect

# List with pexpect-cli
pexpect-cli --list
# Shows: session_id: status (optional_name)

# Follow live output (use task ID from pueue status)
pueue follow <task-id>

# View full logs
pueue log <task-id>
```

**Important**: Session IDs (8-char hex) differ from task IDs (integers in pueue status).

### Stop Sessions

```bash
# Using pexpect-cli
pexpect-cli --stop $session

# Or using pueue with task ID
pueue kill <task-id>
```

### One-Shot Execution

Execute code without persistence (temporary namespace):

```bash
echo 'print(pexpect.spawn("echo hello").read().decode())' | pexpect-cli
```

## Common Patterns

### SSH Automation

```bash
session=$(pexpect-cli --start --name ssh-session)

# Connect
pexpect-cli $session <<'EOF'
child = pexpect.spawn('ssh user@host')
child.expect('password:')
child.sendline('mypassword')
child.expect('\$')
print("Connected!")
EOF

# Run commands
pexpect-cli $session <<'EOF'
child.sendline('uptime')
child.expect('\$')
print(child.before.decode())
EOF

pexpect-cli --stop $session
```

### Database CLI Automation

```bash
session=$(pexpect-cli --start --name db-session)

pexpect-cli $session <<'EOF'
child = pexpect.spawn('sqlite3 mydb.db')
child.expect('sqlite>')
child.sendline('.tables')
child.expect('sqlite>')
print("Tables:", child.before.decode())
EOF
```

### Interactive Editor Automation

```bash
session=$(pexpect-cli --start --name vim-session)

pexpect-cli $session <<'EOF'
child = pexpect.spawn('vim test.txt')
child.expect('.')
child.send('i')  # Insert mode
child.send('Hello from pexpect!')
child.send('\x1b')  # ESC
child.send(':wq\r')  # Save and quit
child.expect(pexpect.EOF)
print("File saved")
EOF
```

### Multiple Parallel Sessions

```bash
# Start multiple sessions
for i in {1..5}; do
    pexpect-cli --start --name "worker-$i"
done

# Execute in all sessions
pexpect-cli --list | awk '{print $1}' | while read -r id; do
    echo "print('Processing in session $id')" | pexpect-cli "$id"
done
```

## Advanced Usage

### Leverage Pueue Features

Since sessions are pueue tasks in the `pexpect` group:

```bash
# Kill all pexpect sessions
pueue clean --group pexpect

# Pause/resume the pexpect group
pueue pause --group pexpect
pueue start --group pexpect
```

### Socket Locations

Sockets stored securely (0o700 permissions):
- Preferred: `$XDG_RUNTIME_DIR/pexpect-cli/{session_id}.sock` (tmpfs, auto-cleanup)
- Fallback: `$XDG_CACHE_HOME/pexpect-cli/sockets/{session_id}.sock` or `~/.cache/pexpect-cli/sockets/{session_id}.sock`

### Persistent Child Variable

The `child` variable persists across executions in the same session:

```bash
# First execution
echo 'child = pexpect.spawn("bash")' | pexpect-cli $session

# Second execution (child still exists)
echo 'child.sendline("pwd")' | pexpect-cli $session
```

## Troubleshooting

### Session Won't Start

Check pueue daemon:
```bash
pueue status  # If fails, start with: pueued -d
```

### Socket Not Found

Verify session is running:
```bash
pueue status --group pexpect
ls -la $XDG_RUNTIME_DIR/pexpect-cli/
```

### View Server Logs

```bash
pueue follow <task-id>  # Real-time
pueue log <task-id>     # Full log
```

## Resources

See `references/patterns.md` for detailed examples of common automation patterns including error handling, timeouts, and complex workflows.

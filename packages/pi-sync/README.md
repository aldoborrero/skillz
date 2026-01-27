# pi-sync

Sync extensions and skills from the skillz repository to `~/.pi/agent/` for use with [pi-coding-agent](https://github.com/niclas-ppr/pi-mono).

## Installation

### Via Nix Flake

```bash
# Run directly
nix run .#pi-sync -- --help

# Install to profile
nix profile install .#pi-sync
```

### Manual

```bash
# Copy script to PATH
cp pi-sync ~/.local/bin/
chmod +x ~/.local/bin/pi-sync
```

## Usage

```bash
pi-sync [OPTIONS] [COMMAND] [ITEMS...]
```

### Commands

| Command | Description |
|---------|-------------|
| `extensions [NAMES...]` | Sync extensions (all if no names given) |
| `skills [NAMES...]` | Sync skills (all if no names given) |
| `all` | Sync everything |
| `list` | List available extensions and skills |
| `status` | Show what's currently synced |

### Options

| Option | Description |
|--------|-------------|
| `-c, --copy` | Copy files instead of symlinking |
| `-f, --force` | Overwrite existing files |
| `-n, --dry-run` | Show what would be done without doing it |
| `-q, --quiet` | Suppress output |
| `-h, --help` | Show help |

## Examples

```bash
# List what's available
pi-sync list

# Preview what would be synced
pi-sync --dry-run all

# Sync everything (creates symlinks)
pi-sync all

# Sync only extensions
pi-sync extensions

# Sync a specific skill
pi-sync skills pexpect-cli

# Copy instead of symlink
pi-sync --copy all

# Force overwrite existing
pi-sync --force all

# Check current sync status
pi-sync status
```

## How It Works

### Symlinks (Default)

By default, `pi-sync` creates symlinks from `~/.pi/agent/` to the skillz repository:

```
~/.pi/agent/
├── extensions/
│   ├── pexpect-cli.ts -> ~/Dev/skillz/pi/extensions/pexpect-cli/pexpect-cli.ts
│   └── kagi-search.ts -> ~/Dev/skillz/pi/extensions/kagi-search/kagi-search.ts
└── skills/
    ├── pexpect-cli -> ~/Dev/skillz/skills/pexpect-cli/
    └── kagi-search -> ~/Dev/skillz/skills/kagi-search/
```

**Benefits of symlinks:**
- Changes in the source repo are immediately available
- Edits in `~/.pi/agent/` update the source (useful for development)
- No duplication of files

### Copies (`--copy`)

With `--copy`, files are copied instead of symlinked:

```bash
pi-sync --copy all
```

**Benefits of copies:**
- Independent from source repository
- Works if source repo is moved/deleted
- Snapshot of a specific version

## Environment Variables

| Variable | Default | Description |
|----------|---------|-------------|
| `SKILLZ_DIR` | Auto-detected | Path to skillz repository |
| `PI_AGENT_DIR` | `~/.pi/agent` | Path to pi agent config directory |

### Auto-detection

`SKILLZ_DIR` is auto-detected by:
1. Using `SKILLZ_DIR` environment variable if set
2. Resolving the script location and finding the repository root

This means you can run `pi-sync` from anywhere once installed.

## Directory Structure

The script expects this structure in the skillz repository:

```
skillz/
├── pi/
│   └── extensions/
│       ├── extension-name/
│       │   └── extension-name.ts
│       └── simple.ts
└── skills/
    └── skill-name/
        ├── SKILL.md
        └── ...
```

Extensions can be:
- Single `.ts` files directly in `pi/extensions/`
- Directories containing a `.ts` file

Skills must be directories containing a `SKILL.md` file.

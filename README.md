# Skillz

A collection of skills and extensions for AI coding agents, including Claude Code skills and pi-coding-agent extensions.

## Overview

This repository contains:

- **Skills** - Markdown-based instructions that teach AI agents how to use CLI tools (compatible with both Claude Code and pi-coding-agent)
- **Pi Extensions** - TypeScript extensions that add tools directly to pi-coding-agent
- **Packages** - Nix-packaged CLI tools

## Repository Structure

```
skillz/
├── skills/                   # Skills (Claude Code + pi-coding-agent)
│   ├── pexpect-cli/          # Interactive CLI automation
│   └── kagi-search/          # Privacy-focused search
├── pi/
│   └── extensions/           # Pi-coding-agent extensions
│       ├── pexpect-cli/      # Interactive CLI automation
│       ├── kagi-search/      # Kagi search integration
│       ├── github-search/    # GitHub code search
│       └── jina/             # Web content fetching
└── packages/                 # Nix packages
    ├── pexpect-cli/          # pexpect-cli CLI tool
    └── pi-sync/              # Sync tool for pi extensions/skills
```

## Skills

Skills are markdown files with a `SKILL.md` that instruct AI agents on how to use external CLI tools. They follow the [Agent Skills](https://agentskills.io) standard and are compatible with:

- **Claude Code** - Loaded via skills configuration
- **pi-coding-agent** - Loaded from `~/.pi/agent/skills/` or `.pi/skills/`

### pexpect-cli

Automate interactive CLI programs with persistent sessions using pexpect and pueue.

**Use cases:**
- SSH sessions with interactive authentication
- Database CLIs (PostgreSQL, MySQL, MongoDB, SQLite)
- Interactive editors (vim, nano)
- Multiple parallel interactive sessions

**Location:** [`skills/pexpect-cli/`](skills/pexpect-cli/)

### kagi-search

Search the Kagi search engine for privacy-focused, ad-free results.

**Use cases:**
- Privacy-focused search results
- Quick Answer instant responses for factual queries
- Complementary search alongside web_search

**Location:** [`skills/kagi-search/`](skills/kagi-search/)

## Pi Extensions

TypeScript extensions that register tools directly in [pi-coding-agent](https://github.com/niclas-ppr/pi-mono).

### pexpect-cli

Tools for managing pexpect sessions:
- `pexpect_start` - Start a new session
- `pexpect_exec` - Execute pexpect code in a session
- `pexpect_stop` - Stop a session
- `pexpect_list` - List active sessions

**Location:** [`pi/extensions/pexpect-cli/`](pi/extensions/pexpect-cli/)

### kagi-search

Tool: `kagi_search` - Search Kagi with Quick Answer support.

**Location:** [`pi/extensions/kagi-search/`](pi/extensions/kagi-search/)

### github-search

Tool: `github_search_code` - Search code across GitHub repositories using the `gh` CLI.

**Parameters:** query, language, owner, repo, extension, filename, limit

**Location:** [`pi/extensions/github-search/`](pi/extensions/github-search/)

### jina

Tool: `fetch_url` - Fetch webpages and convert to markdown using Jina AI.

**Location:** [`pi/extensions/jina/`](pi/extensions/jina/)

## Packages

### pi-sync

Sync extensions and skills to `~/.pi/agent/` for use with pi-coding-agent.

```bash
# List available extensions and skills
pi-sync list

# Sync everything (creates symlinks)
pi-sync all

# Sync specific items
pi-sync extensions pexpect-cli
pi-sync skills kagi-search

# Copy instead of symlink
pi-sync --copy all

# Check current status
pi-sync status
```

**Location:** [`packages/pi-sync/`](packages/pi-sync/)

### pexpect-cli

The pexpect-cli CLI tool packaged with Nix.

**Location:** [`packages/pexpect-cli/`](packages/pexpect-cli/)

## Installation

### Using Nix Flake

```bash
# Run pi-sync directly
nix run .#pi-sync -- list
nix run .#pi-sync -- all

# Install to profile
nix profile install .#pi-sync
```

### Setup for pi-coding-agent

Use `pi-sync` to symlink extensions and skills to `~/.pi/agent/`:

```bash
# Sync everything
pi-sync all

# Or sync separately
pi-sync extensions
pi-sync skills

# Manual alternative
ln -s /path/to/skillz/pi/extensions/github-search/github-search.ts ~/.pi/agent/extensions/
ln -s /path/to/skillz/skills/pexpect-cli ~/.pi/agent/skills/
```

### Setup for Claude Code

Skills can be used by ensuring they're accessible in your Claude Code configuration. The `SKILL.md` frontmatter defines the skill name and description.

## Dependencies

### pexpect-cli (skill & extension)
- `pexpect-cli` CLI tool
- `pueue` and `pueued` daemon
- Python with pexpect module

### kagi-search (skill & extension)
- Valid Kagi session token
- Configuration at `~/.config/kagi/config.json`

### github-search (extension)
- `gh` CLI installed and authenticated (`gh auth login`)

### jina (extension)
- Network access to Jina AI API

## Development

### Building with Nix

```bash
# Enter dev shell
nix develop

# Build all packages
nix build .#pi-sync
nix build .#pexpect-cli

# Format code
nix fmt
```

### Testing Extensions

```bash
# Run pi with a specific extension
pi -e ./pi/extensions/github-search/github-search.ts
```

## Contributing

When adding new skills or extensions:

1. **Skills**: Create `skills/<name>/SKILL.md` with frontmatter (`name`, `description`)
2. **Extensions**: Create `pi/extensions/<name>/<name>.ts` exporting a default function
3. Update this README
4. Run `pi-sync list` to verify detection

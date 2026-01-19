# Contributing to opencode-agent-modes

Thank you for your interest in contributing! This document provides guidelines
and instructions for contributing to this project.

## Getting Started

### Prerequisites

- [Bun](https://bun.sh/) (latest version)
- [Node.js](https://nodejs.org/) >= 18

### Setup

1. Fork the repository
2. Clone your fork:

   ```bash
   git clone https://github.com/<your-username>/opencode-agent-modes.git
   cd opencode-agent-modes
   ```

3. Install dependencies:

   ```bash
   bun install
   ```

4. Verify your setup:

   ```bash
   bun run typecheck
   bun test
   ```

## Development Workflow

### Available Scripts

| Command              | Description                       |
| -------------------- | --------------------------------- |
| `bun run typecheck`  | Run TypeScript type checking      |
| `bun run build`      | Build the project                 |
| `bun run lint`       | Run linter (Biome)                |
| `bun run format`     | Format code with Prettier         |
| `bun test`           | Run tests                         |
| `bun test --watch`   | Run tests in watch mode           |

### Making Changes

1. Create a new branch from `main`:

   ```bash
   git checkout -b feature/your-feature-name
   ```

2. Make your changes

3. Run checks before committing:

   ```bash
   bun run typecheck
   bun run lint
   bun test
   ```

4. Commit your changes following the commit message guidelines below

## Commit Message Guidelines

This project follows [Conventional Commits](https://www.conventionalcommits.org/).

### Format

```text
<type>: <description>

[optional body]
```

### Types

| Type       | Description                                      |
| ---------- | ------------------------------------------------ |
| `feat`     | A new feature                                    |
| `fix`      | A bug fix                                        |
| `docs`     | Documentation only changes                       |
| `style`    | Code style changes (formatting, semicolons, etc) |
| `refactor` | Code changes that neither fix bugs nor add features |
| `test`     | Adding or updating tests                         |
| `chore`    | Maintenance tasks (deps, build, etc)             |

### Examples

```text
feat: add custom preset support
fix: resolve config file path on Windows
docs: update installation instructions
```

## Pull Request Process

1. Ensure all checks pass (`typecheck`, `lint`, `test`)
2. Update documentation if needed
3. Create a pull request with a clear description
4. Link any related issues

### PR Title

Use the same format as commit messages:

```text
feat: add custom preset support
```

## Reporting Issues

When reporting issues, please include:

- A clear description of the problem
- Steps to reproduce
- Expected vs actual behavior
- Environment details (OS, Bun version, etc.)

## Questions?

Feel free to open an issue for any questions or discussions.

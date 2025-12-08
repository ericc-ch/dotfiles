## Context

**CRITICAL:** Whenever you are asked or need to do something related to Effect, you **MUST** reference `@.context/effect/` to understand Effect conventions, patterns, and best practices. It is mandatory to follow Effect-TS idioms consistently throughout the codebase. Do not guess—verify against the context.

You can also find common gotchas, specific patterns, and troubleshooting notes for this project in `@docs/notes.md`. Check this file to avoid common pitfalls.

## Build & Test Commands

- **Run app**: `bun run src/main.tsx` or `bun start`
- **Format code**: `bun run format` (uses Prettier)
- **Type check**: `bun run typecheck` (run after implementation changes)
- **Run all tests**: `bun test`
- **Run single test file**: `bun test src/lib/pactl.test.ts`
- **Run specific test**: `bun test -t "test name pattern"`

## Code Style

- **Formatting**: Prettier with no semicolons, experimental ternaries enabled
- **Imports**: Group by external packages first, then local imports with blank line separation
- **Naming**: camelCase for functions/variables, PascalCase for components/types
- **Nullish coalescing**: Prefer `??` over `||` for default values (only treats `null`/`undefined` as nullish)
- **SolidJS**: Use signals (`createSignal`), resources (`createResource`), and JSX with `@opentui/solid` components

## Testing

- **Framework**: Use `bun:test` - import `describe`, `test`, `expect` from `"bun:test"`
- **Structure**: Group related tests with `describe()`, use descriptive test names
- **Assertions**: Available matchers include `.toBe()`, `.toBeTruthy()`, `.toBeDefined()`, `.toBeGreaterThan()`, `.toThrow()`
- **Coverage**: Only write tests for non-TSX files (lib/ functions, utilities, etc.)

## Git Commits

- **Format**: Use conventional commits - all lowercase, concise (e.g., `feat: add audio device selector`, `fix: handle pactl error output`)
- **No body/description**: Commit message should be single line only, no additional body or description

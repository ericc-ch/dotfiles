## Build & Test Commands

- **Run app**: `bun run src/main.tsx` or `bun start`
- **Format code**: `bun run format` (uses Prettier)
- **Run all tests**: `bun test`
- **Run single test file**: `bun test src/lib/pactl.test.ts`
- **Run specific test**: `bun test -t "test name pattern"`

## Code Style

- **Formatting**: Prettier with no semicolons, experimental ternaries enabled
- **Imports**: Group by external packages first, then local imports with blank line separation
- **Types**: Prefer explicit types for function parameters/returns; export interfaces/types when reusable
- **Naming**: camelCase for functions/variables, PascalCase for components/types
- **Error handling**: Throw errors with descriptive messages including context (e.g., exit codes, command output)
- **JSDoc**: Use for all exported functions with `@param`, `@returns`, and `@see` for references
- **Async/await**: Preferred over `.then()` chains; handle errors with try/catch or `.catch()`
- **SolidJS**: Use signals (`createSignal`), resources (`createResource`), and JSX with `@opentui/solid` components

## Testing

- **Framework**: Use `bun:test` - import `describe`, `test`, `expect` from `"bun:test"`
- **Structure**: Group related tests with `describe()`, use descriptive test names
- **Assertions**: Available matchers include `.toBe()`, `.toBeTruthy()`, `.toBeDefined()`, `.toBeGreaterThan()`, `.toThrow()`

## Git Commits

- **Format**: Use conventional commits - all lowercase, concise (e.g., `feat: add audio device selector`, `fix: handle pactl error output`)
- **No body/description**: Commit message should be single line only, no additional body or description

# Effect Refactor Plan: apps.ts

## Overview

Refactor `src/lib/apps.ts` from raw `Bun.spawn` to `@effect/platform` Command module with a shared `ManagedRuntime`.

## Dependencies

```bash
bun add effect @effect/platform @effect/platform-bun
```

## Files to Create/Modify

### 1. `src/lib/runtime.ts` (new)

```ts
import { BunContext } from "@effect/platform-bun"
import { ManagedRuntime } from "effect"

export const AppRuntime = ManagedRuntime.make(BunContext.layer)
```

### 2. `src/lib/apps.ts` (refactor)

```ts
import * as Command from "@effect/platform/Command"
import type { CommandExecutor } from "@effect/platform/CommandExecutor"
import type { PlatformError } from "@effect/platform/Error"
import * as Effect from "effect/Effect"
import { pipe } from "effect/Function"
import * as Schema from "effect/Schema"

// Schema for application data
const Application = Schema.Struct({
  name: Schema.String,
  entry: Schema.String,
  executable: Schema.String,
  description: Schema.NullOr(Schema.String),
  icon_name: Schema.String,
  frequency: Schema.Number,
  keywords: Schema.Array(Schema.String),
  categories: Schema.Array(Schema.String),
})

export type Application = typeof Application.Type

// Parse JSON string into array of Applications
const Applications = Schema.Array(Application)
const decodeApplications = Schema.decodeUnknown(Schema.parseJson(Applications))

// Tagged error for parse failures
export class ParseError extends Schema.TaggedError<ParseError>()("ParseError", {
  message: Schema.String,
}) {}

// Tagged error for non-zero exit codes
export class CommandError extends Schema.TaggedError<CommandError>()(
  "CommandError",
  {
    command: Schema.String,
    exitCode: Schema.Number,
  },
) {}

export const listApps = (
  searchTerm?: string,
): Effect.Effect<
  readonly Application[],
  PlatformError | ParseError,
  CommandExecutor
> =>
  Effect.gen(function* () {
    const command =
      searchTerm ?
        Command.make("astal-apps", "--search", searchTerm, "--json")
      : Command.make("astal-apps", "--json")

    const output = yield* Command.string(command)
    const apps = yield* decodeApplications(output).pipe(
      Effect.mapError((e) => new ParseError({ message: e.message })),
    )
    return apps
  })

// Alt: pipe style
export const listAppsAlt = (
  searchTerm?: string,
): Effect.Effect<
  readonly Application[],
  PlatformError | ParseError,
  CommandExecutor
> =>
  pipe(
    searchTerm ?
      Command.make("astal-apps", "--search", searchTerm, "--json")
    : Command.make("astal-apps", "--json"),
    Command.string,
    Effect.flatMap((output) =>
      decodeApplications(output).pipe(
        Effect.mapError((e) => new ParseError({ message: e.message })),
      ),
    ),
  )

export const launchApp = (
  name: string,
): Effect.Effect<void, PlatformError | CommandError, CommandExecutor> =>
  Effect.gen(function* () {
    const command = Command.make("astal-apps", "--launch", name)
    const code = yield* Command.exitCode(command)

    if (code !== 0) {
      yield* new CommandError({
        command: `astal-apps --launch ${name}`,
        exitCode: code,
      })
    }
  })

// Alt: pipe style
export const launchAppAlt = (
  name: string,
): Effect.Effect<void, PlatformError | CommandError, CommandExecutor> =>
  pipe(
    Command.make("astal-apps", "--launch", name),
    Command.exitCode,
    Effect.flatMap((code) =>
      code !== 0 ?
        Effect.fail(
          new CommandError({
            command: `astal-apps --launch ${name}`,
            exitCode: code,
          }),
        )
      : Effect.void,
    ),
  )
```

### 3. `src/lib/apps.test.ts` (update)

```ts
import { describe, test, expect } from "bun:test"
import * as Effect from "effect/Effect"
import * as Exit from "effect/Exit"
import { AppRuntime } from "./runtime"
import { listApps, launchApp, Application } from "./apps"

describe("listApps", () => {
  test("returns array of applications", async () => {
    const apps = await AppRuntime.runPromise(listApps())
    expect(apps).toBeDefined()
    expect(Array.isArray(apps)).toBe(true)
    expect(apps.length).toBeGreaterThan(0)
  })

  test("each app has required properties", async () => {
    const apps = await AppRuntime.runPromise(listApps())
    const app = apps[0]
    expect(app?.name).toBeDefined()
    expect(app?.entry).toBeDefined()
    expect(app?.executable).toBeDefined()
    expect(app?.icon_name).toBeDefined()
    expect(app?.frequency).toBeDefined()
    expect(Array.isArray(app?.keywords)).toBe(true)
    expect(Array.isArray(app?.categories)).toBe(true)
  })
})

describe("listApps with search", () => {
  test("returns filtered apps by search term", async () => {
    const apps = await AppRuntime.runPromise(listApps("terminal"))
    expect(Array.isArray(apps)).toBe(true)
  })

  test("returns empty array for non-matching search", async () => {
    const apps = await AppRuntime.runPromise(listApps("xyznonexistentapp12345"))
    expect(Array.isArray(apps)).toBe(true)
  })
})

describe("launchApp", () => {
  test("fails for invalid app name", async () => {
    const exit = await AppRuntime.runPromiseExit(
      launchApp("nonexistent app 12345"),
    )
    expect(Exit.isFailure(exit)).toBe(true)
  })
})
```

### 4. App Entrypoints (add cleanup)

In `src/bar.tsx` and `src/dashboard.tsx`:

```ts
import { AppRuntime } from "./lib/runtime"

process.on("SIGINT", () => AppRuntime.dispose())
process.on("SIGTERM", () => AppRuntime.dispose())
```

## Key Concepts

### ManagedRuntime

- Created once at app startup from `BunContext.layer`
- Provides `CommandExecutor`, `FileSystem`, `Path`, `Terminal`, `WorkerManager`
- Use `AppRuntime.runPromise(effect)` to execute effects
- Call `AppRuntime.dispose()` on app exit

### Command Module

- `Command.make(cmd, ...args)` - creates a command
- `Command.string(command)` - runs and returns stdout as string, fails with `PlatformError` on spawn errors
- `Command.exitCode(command)` - runs and returns exit code (does NOT fail on non-zero)
- `Command.lines(command)` - runs and returns stdout as array of lines

### Error Handling

- `PlatformError` - built-in error for spawn failures, permission denied, etc.
- `ParseError` - custom tagged error for schema validation failures
- `CommandError` - custom tagged error for non-zero exit codes (since `Command.exitCode` doesn't fail)

### Schema

```ts
import * as Schema from "effect/Schema"

// Define a struct schema for plain data
const Application = Schema.Struct({
  name: Schema.String,
  description: Schema.NullOr(Schema.String),
  keywords: Schema.Array(Schema.String),
})

// Extract the type from the schema
type Application = typeof Application.Type

// Parse JSON string directly into typed array
const Applications = Schema.Array(Application)
const decodeApplications = Schema.decodeUnknown(Schema.parseJson(Applications))

// Usage: yields ParseError on invalid JSON or schema mismatch
const apps =
  yield
  * decodeApplications(jsonString).pipe(
    Effect.mapError((e) => new ParseError({ message: e.message })),
  )
```

### Tagged Errors (with Schema)

```ts
import * as Schema from "effect/Schema"

// Define tagged errors using Schema.TaggedError
export class ParseError extends Schema.TaggedError<ParseError>()("ParseError", {
  message: Schema.String,
}) {}

export class CommandError extends Schema.TaggedError<CommandError>()(
  "CommandError",
  {
    command: Schema.String,
    exitCode: Schema.Number,
  },
) {}

// Usage: yield* new CommandError({ command: "...", exitCode: 1 })
```

## Execution Order

1. `bun add effect @effect/platform @effect/platform-bun`
2. Create `src/lib/runtime.ts`
3. Refactor `src/lib/apps.ts`
4. Update `src/lib/apps.test.ts`
5. Add disposal handlers to `src/bar.tsx` and `src/dashboard.tsx`
6. Run `bun test`
7. Run `bun run typecheck`

## Reference

Effect context available at `.context/effect/` for patterns and examples.

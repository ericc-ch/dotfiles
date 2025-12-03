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
import * as Data from "effect/Data"
import * as Effect from "effect/Effect"

export interface Application {
  name: string
  entry: string
  executable: string
  description: string | null
  icon_name: string
  frequency: number
  keywords: string[]
  categories: string[]
}

// Simple error for non-zero exit codes
export class CommandError extends Data.TaggedError("CommandError")<{
  readonly command: string
  readonly exitCode: number
}> {}

export const listApps = (
  searchTerm?: string,
): Effect.Effect<Application[], PlatformError, CommandExecutor> =>
  Effect.gen(function* () {
    const command =
      searchTerm ?
        Command.make("astal-apps", "--search", searchTerm, "--json")
      : Command.make("astal-apps", "--json")

    const output = yield* Command.string(command)
    return JSON.parse(output) as Application[]
  })

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
```

### 3. `src/lib/apps.test.ts` (update)

```ts
import { describe, test, expect } from "bun:test"
import * as Effect from "effect/Effect"
import * as Exit from "effect/Exit"
import { AppRuntime } from "./runtime"
import { listApps, launchApp } from "./apps"

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
- `CommandError` - custom tagged error for non-zero exit codes (since `Command.exitCode` doesn't fail)
- `JSON.parse` throws as defect (untyped) - acceptable for now

### Tagged Errors

```ts
import * as Data from "effect/Data"

export class CommandError extends Data.TaggedError("CommandError")<{
  readonly command: string
  readonly exitCode: number
}> {}

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

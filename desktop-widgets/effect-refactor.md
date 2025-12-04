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
import * as Chunk from "effect/Chunk"
import * as Data from "effect/Data"
import * as Effect from "effect/Effect"
import { pipe } from "effect/Function"
import * as Schema from "effect/Schema"
import * as Stream from "effect/Stream"

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
export class ParseError extends Data.TaggedError("ParseError")<{
  readonly message: string
}> {}

// Tagged error for non-zero exit codes
export class CommandError extends Data.TaggedError("CommandError")<{
  readonly command: string
  readonly exitCode: number
  readonly stderr: string
}> {}

// Helper to collect a stream of bytes into a string
const streamToString = (stream: Stream.Stream<Uint8Array, PlatformError>) =>
  pipe(
    stream,
    Stream.decodeText(),
    Stream.runCollect,
    Effect.map(Chunk.join("")),
  )

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
): Effect.Effect<number, PlatformError | CommandError, CommandExecutor> =>
  Effect.gen(function* () {
    const command = Command.make("astal-apps", "--launch", name)
    const process = yield* Command.start(command)
    const exitCode = yield* process.exitCode

    if (exitCode !== 0) {
      const stderr = yield* streamToString(process.stderr)
      yield* new CommandError({
        command: `astal-apps --launch ${name}`,
        exitCode,
        stderr,
      })
    }

    return exitCode
  })

// Alt: pipe style
export const launchAppAlt = (
  name: string,
): Effect.Effect<number, PlatformError | CommandError, CommandExecutor> =>
  Effect.gen(function* () {
    const command = Command.make("astal-apps", "--launch", name)
    const process = yield* Command.start(command)
    const [exitCode, stderr] = yield* Effect.all([
      process.exitCode,
      streamToString(process.stderr),
    ])

    return yield* pipe(
      Effect.succeed(exitCode),
      Effect.filterOrFail(
        (code) => code === 0,
        () =>
          new CommandError({
            command: `astal-apps --launch ${name}`,
            exitCode,
            stderr,
          }),
      ),
    )
  })
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
- `Command.start(command)` - starts process, returns `Process` with access to streams

**Capturing stderr:**

```ts
import * as Stream from "effect/Stream"
import * as Chunk from "effect/Chunk"

// Helper to collect a stream of bytes into a string
const streamToString = (stream: Stream.Stream<Uint8Array, PlatformError>) =>
  pipe(
    stream,
    Stream.decodeText(),
    Stream.runCollect,
    Effect.map(Chunk.join("")),
  )

// Use Command.start() to access process streams
const process = yield * Command.start(command)
const exitCode = yield * process.exitCode
const stderr = yield * streamToString(process.stderr)
const stdout = yield * streamToString(process.stdout)
```

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

### Tagged Errors

There are three TaggedError variants in Effect:

**`Data.TaggedError`** — lightweight, no runtime validation

```ts
import * as Data from "effect/Data"

export class CommandError extends Data.TaggedError("CommandError")<{
  readonly command: string
  readonly exitCode: number
}> {}

// Usage: yield* new CommandError({ command: "...", exitCode: 1 })
```

**`Schema.TaggedError`** — full schema support, runtime validation, JSON encoding

```ts
import * as Schema from "effect/Schema"

export class HttpError extends Schema.TaggedError<HttpError>()("HttpError", {
  status: Schema.Number,
  message: Schema.String,
}) {
  get description(): string {
    return `HTTP ${this.status}: ${this.message}`
  }
}
```

**`Micro.TaggedError`** — for Micro effects (experimental)

**When to use:**

- `Data.TaggedError` — internal domain errors, simple error types
- `Schema.TaggedError` — API boundaries, need validation/encoding, custom methods

### Schema.TaggedError Deep Dive

`Schema.TaggedError` provides capabilities that `Data.TaggedError` doesn't have:

**1. Encoding/Decoding from unknown data**

```ts
class ApiError extends Schema.TaggedError<ApiError>()("ApiError", {
  code: Schema.Number,
  message: Schema.String,
}) {}

// Decode from JSON (e.g., from HTTP response)
const error = Schema.decodeUnknownSync(ApiError)({
  _tag: "ApiError",
  code: 404,
  message: "Not found",
})

// Encode back to JSON
const json = Schema.encodeSync(ApiError)(error)
```

**2. Custom methods and computed properties**

```ts
class HttpRequestError extends Schema.TaggedError<HttpRequestError>()(
  "HttpRequestError",
  {
    method: Schema.String,
    url: Schema.String,
    status: Schema.Number,
    reason: Schema.Literal("Timeout", "NetworkError", "ServerError"),
  },
) {
  get message(): string {
    return `${this.method} ${this.url} failed: ${this.reason} (${this.status})`
  }

  get isRetryable(): boolean {
    return this.reason === "Timeout" || this.status >= 500
  }
}
```

**3. HTTP API integration with status codes**

```ts
import { HttpApiSchema } from "@effect/platform"

class Unauthorized extends Schema.TaggedError<Unauthorized>()(
  "Unauthorized",
  { message: Schema.String },
  HttpApiSchema.annotations({ status: 401 }),
) {}

class NotFound extends Schema.TaggedError<NotFound>()(
  "NotFound",
  { resource: Schema.String },
  HttpApiSchema.annotations({ status: 404 }),
) {}
```

**4. Union of errors for comprehensive handling**

```ts
const AppError = Schema.Union(Unauthorized, NotFound, HttpRequestError)

// Decode any error from the union
const parseError = Schema.decodeUnknown(AppError)
```

**5. JSON Schema generation (for API docs)**

```ts
import * as JSONSchema from "effect/JSONSchema"

const schema = JSONSchema.make(ApiError)
// Generates OpenAPI-compatible JSON Schema
```

**6. Custom constructors with `.make()`**

```ts
class ValidationError extends Schema.TaggedError<ValidationError>()(
  "ValidationError",
  { field: Schema.String, message: Schema.String },
) {
  static forRequired(field: string) {
    return new ValidationError({ field, message: `${field} is required` })
  }
}

// All work
new ValidationError({ field: "email", message: "invalid" })
ValidationError.make({ field: "email", message: "invalid" })
ValidationError.forRequired("email")
```

**Summary: Schema.TaggedError unique features**

| Feature                | Data.TaggedError | Schema.TaggedError |
| ---------------------- | ---------------- | ------------------ |
| Lightweight            | ✅               | ❌                 |
| Runtime validation     | ❌               | ✅                 |
| Encode/decode JSON     | ❌               | ✅                 |
| Custom methods         | ❌               | ✅                 |
| HTTP status mapping    | ❌               | ✅                 |
| JSON Schema generation | ❌               | ✅                 |
| Union composition      | ❌               | ✅                 |

## Execution Order

1. `bun add effect @effect/platform @effect/platform-bun`
2. Create `src/lib/runtime.ts`
3. Refactor `src/lib/apps.ts`
4. Update `src/lib/apps.test.ts`
5. Add disposal handlers to `src/bar.tsx` and `src/dashboard.tsx`
6. Run `bun test`
7. Run `bun run typecheck`

## JSDoc Conventions

Effect uses consistent JSDoc patterns:

**Standard tags:**

- `@since` — version when API was introduced
- `@category` — functional grouping (e.g., "constructors", "combinators", "guards")
- `@example` — code examples with TypeScript
- `@experimental` — for unstable APIs
- `@see` — cross-references to related functions

**Effect function documentation:**

````ts
/**
 * Lists installed applications, optionally filtered by search term.
 *
 * **When to Use**
 *
 * Use this to populate app launchers or search interfaces.
 *
 * **Example**
 *
 * ```ts
 * import { Effect } from "effect"
 * import { listApps } from "./apps"
 *
 * //      ┌─── Effect<readonly Application[], PlatformError | ParseError, CommandExecutor>
 * //      ▼
 * const program = listApps("terminal")
 * ```
 *
 * @since 1.0.0
 * @category queries
 */
export const listApps = (searchTerm?: string): Effect.Effect<...> => ...
````

**Type signature comments:**

```ts
// Show the full Effect signature inline
//      ┌─── Effect<number, CommandError, CommandExecutor>
//      ▼
const result = launchApp("Firefox")
```

**Sections to include:**

- **When to Use** — scenarios where the function is appropriate
- **Details** — in-depth explanation of behavior
- **Example** — concrete usage with types shown

**Schema documentation:**

```ts
/**
 * Schema for desktop application metadata.
 *
 * @since 1.0.0
 * @category schemas
 */
const Application = Schema.Struct({
  /** Display name of the application */
  name: Schema.String,
  /** .desktop file path */
  entry: Schema.String,
  /** Executable command */
  executable: Schema.String,
  /** Optional description from .desktop file */
  description: Schema.NullOr(Schema.String),
  /** Icon name for theming */
  icon_name: Schema.String,
  /** Launch frequency for sorting */
  frequency: Schema.Number,
  /** Search keywords */
  keywords: Schema.Array(Schema.String),
  /** Desktop categories (e.g., "Utility", "Development") */
  categories: Schema.Array(Schema.String),
})
```

**Tagged error documentation:**

```ts
/**
 * Error thrown when a command exits with non-zero status.
 *
 * @since 1.0.0
 * @category errors
 */
export class CommandError extends Data.TaggedError("CommandError")<{
  /** The full command that was executed */
  readonly command: string
  /** The non-zero exit code */
  readonly exitCode: number
}> {}
```

## Reference

Effect context available at `.context/effect/` for patterns and examples.

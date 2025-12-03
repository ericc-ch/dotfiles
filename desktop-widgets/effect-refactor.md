# Effect-TS Refactoring Plan for desktop-widgets

## Overview

This document outlines the plan to incrementally refactor the `desktop-widgets` lib modules to use Effect-TS patterns.

## Key Insight: Incremental Adoption

**You do NOT need to wrap your entire codebase in Effect.**

Effect is designed for boundary-based integration:
- Write Effect code internally (business logic, error handling, async operations)
- "Unwrap" at boundaries using `Effect.runPromise()` where Effect meets non-Effect code (SolidJS components)

## Integration Options

### Option A: Effect-internal, Promise-external (Recommended)

Keep existing Promise-based exports. Components don't change.

```typescript
// Internal implementation uses Effect
const listAppsEffect = Command.make("astal-apps", "--json").pipe(
  Command.string,
  Effect.flatMap(parseJson(Application.Array))
)

// Export Promise-based API for existing consumers
export const listApps = () => Effect.runPromise(listAppsEffect)
```

**Pros:**
- Zero changes to SolidJS components
- Gradual migration path
- Can switch to full Effect later

**Cons:**
- Loses typed errors at boundary (becomes `Promise<T>` not `Effect<T, E, R>`)
- Two representations of same logic

### Option B: Full Effect API

Export Effect directly. All consumers must handle Effect.

```typescript
export const listApps = Command.make("astal-apps", "--json").pipe(
  Command.string,
  Effect.flatMap(parseJson(Application.Array))
)

// Component usage:
const apps = await Effect.runPromise(listApps)
```

**Pros:**
- Full typed errors propagate
- Consistent Effect usage throughout
- Better composability

**Cons:**
- Requires updating all component call sites
- More invasive change

## Refactoring Order (Simplest → Complex)

| Priority | File | Complexity | Key Patterns |
|----------|------|------------|--------------|
| 1 | `truncate.ts` | Simplest | Pure function, no async |
| 2 | `color.ts` | Simple | Pure functions + one async call |
| 3 | `apps.ts` | Medium | `Command.string`, JSON parsing, typed errors |
| 4 | `audio.ts` | Medium-High | `Command.string` + `Command.streamLines` for monitor |
| 5 | `network.ts` | Complex | Multiple commands, file reads, monitors, polling |
| — | `debounce.ts` | Skip | SolidJS reactive primitives - keep as-is |

## Effect Patterns to Use

### 1. Running Shell Commands

Use `@effect/platform` Command API instead of `Bun.spawn`:

```typescript
import { Command } from "@effect/platform"
import { BunContext, BunRuntime } from "@effect/platform-bun"

// Simple command → string
const result = yield* Command.make("pactl", "--format=json", "list", "sinks").pipe(
  Command.string
)

// Command → parsed JSON
const sinks = yield* Command.make("pactl", "--format=json", "list", "sinks").pipe(
  Command.string,
  Effect.flatMap(parseJson(SinkArray))
)

// Command → exit code only
const exitCode = yield* Command.make("pactl", "set-default-sink", name).pipe(
  Command.exitCode
)
```

### 2. Typed Errors

```typescript
import { Data } from "effect"

class CommandFailed extends Data.TaggedError("CommandFailed")<{
  command: string
  exitCode: number
  stderr: string
}> {}

class ParseError extends Data.TaggedError("ParseError")<{
  message: string
  raw: string
}> {}

class DeviceNotFound extends Data.TaggedError("DeviceNotFound")<{
  device: string
}> {}
```

### 3. Streaming / Long-running Processes

For monitors (audio, network), use Effect Streams:

```typescript
import { Stream } from "effect"

// Stream lines from a command
const events = Command.make("pactl", "subscribe").pipe(
  Command.streamLines,
  Stream.map(parseSubscribeLine),
  Stream.filter((e): e is AudioEvent => e !== null)
)

// Consume the stream
yield* events.pipe(
  Stream.runForEach((event) => 
    Effect.sync(() => options.onVolumeChange?.(event))
  )
)
```

### 4. File Reading

```typescript
import { FileSystem } from "@effect/platform"

const readWifiSignal = (device = "wlan0") =>
  Effect.gen(function* () {
    const fs = yield* FileSystem.FileSystem
    const content = yield* fs.readFileString("/proc/net/wireless")
    // parse content...
  })
```

### 5. Running at Boundaries (SolidJS integration)

```typescript
// In component
import { listApps } from "../lib/apps"

const [apps] = createResource(() => Effect.runPromise(listApps()))

// Or with error handling
const [apps] = createResource(() => 
  Effect.runPromise(
    listApps().pipe(
      Effect.tapError((e) => Effect.log("Failed to list apps", e))
    )
  )
)
```

## Dependencies to Add

```json
{
  "dependencies": {
    "effect": "^3.x",
    "@effect/platform": "^0.x",
    "@effect/platform-bun": "^0.x"
  }
}
```

## File-by-File Plan

### 1. truncate.ts (Pure Function)

**Current:** Pure function, no changes needed for Effect per se, but can add Schema validation.

**Refactored:**
```typescript
import { String } from "effect"

// Could stay as-is, or use Effect String utilities if beneficial
export const truncate = (str: string, maxLength: number): string => {
  // ... same logic
}
```

**Verdict:** Likely keep as-is. Pure functions don't need Effect wrapping.

---

### 2. color.ts (Pure + One Async)

**Current:** Pure color manipulation + `getTerminalPalette(renderer)` async call.

**Changes:**
- Pure functions (`darkenColor`, `lightenColor`, etc.) stay as-is
- `createColorPalette` becomes Effect-based

```typescript
export const createColorPalette = (renderer: CliRenderer) =>
  Effect.tryPromise({
    try: () => renderer.getPalette({ size: 16 }),
    catch: (e) => new PaletteError({ cause: e })
  }).pipe(
    Effect.map(buildPalette)
  )
```

---

### 3. apps.ts

**Current:**
```typescript
export async function listApps(searchTerm?: string): Promise<Application[]>
export async function launchApp(name: string): Promise<void>
```

**Refactored:**
```typescript
export const listApps = (searchTerm?: string) =>
  Effect.gen(function* () {
    const args = searchTerm 
      ? ["astal-apps", "--search", searchTerm, "--json"]
      : ["astal-apps", "--json"]
    
    const output = yield* Command.make(...args).pipe(Command.string)
    return yield* parseJson(ApplicationArray)(output)
  })

export const launchApp = (name: string) =>
  Command.make("astal-apps", "--launch", name).pipe(
    Command.exitCode,
    Effect.flatMap((code) =>
      code === 0 
        ? Effect.void 
        : Effect.fail(new LaunchFailed({ name, exitCode: code }))
    )
  )
```

---

### 4. audio.ts

**Current:**
- Multiple `Bun.spawn` calls for pactl commands
- `createAudioMonitor` with callback-based event stream

**Refactored:**
```typescript
// Commands become Effect-based
export const listSinks = Command.make("pactl", "--format=json", "list", "sinks").pipe(
  Command.string,
  Effect.flatMap(parseJson(SinkArray))
)

export const getDefaultSinkVolume = Effect.all({
  volume: Command.make("pactl", "--format=json", "get-sink-volume", "@DEFAULT_SINK@").pipe(
    Command.string,
    Effect.flatMap(parseJson(VolumeResponse))
  ),
  mute: Command.make("pactl", "--format=json", "get-sink-mute", "@DEFAULT_SINK@").pipe(
    Command.string,
    Effect.flatMap(parseJson(MuteResponse))
  )
}).pipe(Effect.map(({ volume, mute }) => ({ volume: extractPercent(volume), muted: mute.mute })))

// Monitor becomes a Stream
export const audioEvents: Stream.Stream<AudioEvent, PlatformError, CommandExecutor> =
  Command.make("pactl", "subscribe").pipe(
    Command.streamLines,
    Stream.map(parseSubscribeLine),
    Stream.filter((e): e is AudioEvent => e !== null)
  )
```

---

### 5. network.ts

**Current:** Most complex - multiple nmcli commands, /proc file reads, monitors with polling.

**Refactored:**
- Commands → Effect with Command API
- File reads → FileSystem service
- Monitor → Stream with `Stream.merge` for combining event stream + polling
- Polling → `Stream.repeat` with `Schedule`

```typescript
export const readWifiSignal = (device = "wlan0") =>
  Effect.gen(function* () {
    const fs = yield* FileSystem.FileSystem
    const content = yield* fs.readFileString("/proc/net/wireless").pipe(
      Effect.option  // Returns Option<string> instead of failing
    )
    return pipe(
      content,
      Option.flatMap(parseWifiSignal(device))
    )
  })

// Polling stream
export const signalPolling = (device: string, interval: Duration.Duration) =>
  Stream.repeatEffect(readWifiSignal(device)).pipe(
    Stream.schedule(Schedule.spaced(interval))
  )
```

## Open Questions

1. **Option A vs Option B?** - Keep Promise exports or go full Effect?
2. **Typed errors granularity?** - One error per module or fine-grained?
3. **Monitor API?** - Keep callbacks or expose Streams directly?
4. **Schema validation?** - Use `@effect/schema` for JSON parsing?

## Next Steps

1. Add Effect dependencies to package.json
2. Start with `apps.ts` (good balance of patterns without complexity)
3. Update tests to use `@effect/vitest`
4. Iterate on audio.ts and network.ts

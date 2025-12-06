# Daemon Manager Plan

A centralized daemon manager for handling long-running background processes (audio monitor, network monitor, wallpaper daemon, etc.) with restart policies, logging, and health monitoring using Effect-TS.

**Note:** This is specifically for **daemons** (long-running processes that should stay alive). One-shot commands like `launchApp` are kept separate - they have different lifecycles and guarantees.

## Goals

1. **Centralized management** of long-running daemon processes
2. **Restart on failure** with configurable exponential backoff + max attempts
3. **Health monitoring** - know when daemons are running/stopped/restarting/failed
4. **Output streaming** - consumers can process daemon stdout
5. **Structured logging** with optional file output and TUI display

## Current State

### audio.ts

- `createAudioMonitor()` spawns `pactl subscribe`
- Manual restart logic with `setTimeout(..., 1000)` on exit
- Callback-based API (`onVolumeChange`, `onError`, etc.)
- Manual `stopped` flag for cleanup

### network.ts

- `createNetworkMonitor()` spawns `nmcli monitor`
- Same manual restart pattern with `setTimeout(..., 1000)`
- Additional `setInterval` for signal polling
- Callback-based API (`onConnect`, `onDisconnect`, etc.)

### Problems

- Duplicated restart logic
- No visibility into daemon health
- No centralized logging
- Callbacks don't compose well with Effect
- No backoff strategy (always 1 second)

---

## Architecture

### Layered Design

```
┌─────────────────────────────────────────────────────┐
│  Consumer (UI Components)                           │
│  - Uses Network, Audio services directly            │
└──────────────────────┬──────────────────────────────┘
                       │
┌──────────────────────▼──────────────────────────────┐
│  Domain Services (Network, Audio, Wallpaper, etc.)  │
│  - Business logic, parsing, state management        │
│  - Uses DaemonManager for process lifecycle         │
│  - Handles output processing                        │
│  - Exposes PubSub for domain events                 │
└──────────────────────┬──────────────────────────────┘
                       │
┌──────────────────────▼──────────────────────────────┐
│  DaemonManager                                       │
│  - Pure process lifecycle (start/stop/restart)      │
│  - Health monitoring via SubscriptionRef            │
│  - Restart policies with Schedule                   │
│  - Output streaming (Stream per daemon)             │
│  - Centralized logging via PubSub                   │
└─────────────────────────────────────────────────────┘
```

### Data Flow Example (Network Service)

```
nmcli monitor (daemon)
      │
      │ Stream<string> (raw lines, single consumer)
      ▼
Network Service
      │
      │ parses lines, manages state
      │
      ├──► SubscriptionRef<NetworkState>  (UI subscribes here)
      │
      └──► PubSub<NetworkEvent>  (optional, for event consumers)
```

### DaemonManager Internals

```
┌─────────────────────────────────────────────────────────────────┐
│                      DaemonManager (Layer)                       │
├─────────────────────────────────────────────────────────────────┤
│                                                                  │
│  Registered Daemons (static config + dynamic registration)       │
│                                                                  │
│  ┌─────────────────┐  ┌─────────────────┐  ┌─────────────────┐  │
│  │  audio          │  │  network        │  │  wallpaper      │  │
│  │  pactl subscribe│  │  nmcli monitor  │  │  swww-daemon    │  │
│  │                 │  │                 │  │                 │  │
│  │ SubscriptionRef │  │ SubscriptionRef │  │ SubscriptionRef │  │
│  │ <DaemonState>   │  │ <DaemonState>   │  │ <DaemonState>   │  │
│  │                 │  │                 │  │                 │  │
│  │ Stream<stdout>  │  │ Stream<stdout>  │  │ (no output)     │  │
│  └─────────────────┘  └─────────────────┘  └─────────────────┘  │
│                                                                  │
│                    ┌───────────────────────┐                    │
│                    │   PubSub<LogEvent>    │                    │
│                    │   (sliding window)    │                    │
│                    └───────────────────────┘                    │
│                                                                  │
└─────────────────────────────────────────────────────────────────┘
```

---

## Usage Examples

### Basic Usage

```typescript
import { Effect, Stream } from "effect"
import { DaemonManager } from "./lib/daemon-manager"

const program = Effect.gen(function* () {
  const dm = yield* DaemonManager

  // 1. Register daemons
  yield* dm.register("audio", {
    command: ["pactl", "subscribe"],
    restartPolicy: { baseDelay: "1 second", maxDelay: "30 seconds" },
    captureOutput: true,
  })

  yield* dm.register("wallpaper", {
    command: ["swww-daemon"],
    restartPolicy: { baseDelay: "1 second", maxAttempts: 5 },
    captureOutput: false,
  })

  // 2. Start daemons
  yield* dm.start("audio")
  yield* dm.start("wallpaper")

  // 3. Process audio output (consumer's responsibility)
  yield* dm.getOutput("audio").pipe(
    Stream.map(parseSubscribeLine),
    Stream.filter((event) => event !== null),
    Stream.tap((event) => handleAudioEvent(event)),
    Stream.runDrain,
    Effect.fork,
  )

  // 4. Subscribe to state changes for UI
  yield* dm.subscribe("audio").pipe(
    Stream.tap((state) =>
      Effect.log(
        `Audio daemon: ${state.status} (restarts: ${state.restartCount})`,
      ),
    ),
    Stream.runDrain,
    Effect.fork,
  )

  // 5. Subscribe to all daemon logs
  yield* dm.logs().pipe(
    Stream.tap((log) =>
      Effect.log(`[${log.daemon}] ${log.level}: ${log.message}`),
    ),
    Stream.runDrain,
    Effect.fork,
  )
})
```

### Stopping and Restarting

```typescript
const manualControl = Effect.gen(function* () {
  const dm = yield* DaemonManager

  // Stop a daemon (sends SIGTERM)
  yield* dm.stop("audio")

  // Restart a daemon
  yield* dm.restart("wallpaper")

  // Check current state
  const state = yield* dm.getState("audio")
  if (state.status === "failed") {
    yield* Effect.log(`Audio failed after ${state.restartCount} restarts`)
  }
})
```

---

## Effect Patterns for Process Management

> **Reference Section:** The following sections document Effect patterns used in DaemonManager implementation.

### 1. Schedule - Retry/Restart Policies

A `Schedule<Out, In, R>` defines recurring schedules that consume values of type `In` and return values of type `Out`. Used for retry policies, repetition, and timing control.

```
Schedule<Out, In, Requirements>
         │    │    └── Additional context requirements
         │    └────── Input consumed (errors for retry, values for repeat)
         └─────────── Output produced by the schedule
```

#### Key Constructors

**`Schedule.exponential(base, factor?)`**
Creates a schedule with exponentially increasing delays.

- Formula: `base * factor^n` where n is attempt number
- Default factor is 2 (delays double each time)
- Recurs indefinitely

```typescript
// 1s, 2s, 4s, 8s, 16s, ...
Schedule.exponential("1 second")

// 1s, 3s, 9s, 27s, ... (factor = 3)
Schedule.exponential("1 second", 3)
```

**`Schedule.recurs(n)`**
A schedule that recurs exactly n times before terminating.

- Output is the current count of recurrences
- Stops after n executions

```typescript
// Retry up to 5 times
Schedule.recurs(5)
```

**`Schedule.forever`**
A schedule that recurs indefinitely, producing a count of repetitions (0, 1, 2, ...).

```typescript
// Never stops
Schedule.forever
```

**`Schedule.spaced(duration)`**
Fixed delay between end of one execution and start of next.

```typescript
// 1 second gap between executions
Schedule.spaced("1 second")
```

**`Schedule.fixed(interval)`**
Fixed interval from start to start (handles pile-ups).

```typescript
// Every 1 second, regardless of execution time
Schedule.fixed("1 second")
```

#### Combinators

**`Schedule.jittered`**
Adds randomness to prevent thundering herd problem. By default varies delay between 80% and 120% of original interval.

```typescript
Schedule.exponential("1 second").pipe(
  Schedule.jittered, // 800ms-1200ms, 1600ms-2400ms, ...
)

// Custom range
Schedule.exponential("1 second").pipe(
  Schedule.jitteredWith({ min: 0.5, max: 1.5 }), // 50%-150%
)
```

**`Schedule.intersect`** (AND)
Combines two schedules, continuing only if BOTH want to continue. Uses the longer delay.

```typescript
// Exponential backoff AND max 5 retries
Schedule.exponential("1 second").pipe(Schedule.intersect(Schedule.recurs(5)))
```

**`Schedule.union`** (OR)
Combines two schedules, continuing if EITHER wants to continue. Uses the shorter delay.

**`Schedule.andThen`** (Sequential)
Runs first schedule to completion, then switches to second.

```typescript
// 3 fast retries, then slower retries
Schedule.recurs(3).pipe(
  Schedule.intersect(Schedule.spaced("100 millis")),
  Schedule.andThen(Schedule.spaced("5 seconds")),
)
```

#### Common Patterns for Daemon Restart

```typescript
// Pattern 1: Exponential backoff with jitter, max 10 attempts
const restartPolicy = Schedule.exponential("1 second").pipe(
  Schedule.jittered,
  Schedule.intersect(Schedule.recurs(10)),
)

// Pattern 2: Fast retries first, then slow with cap
const robustPolicy = Schedule.recurs(3).pipe(
  Schedule.intersect(Schedule.spaced("500 millis")),
  Schedule.andThen(
    Schedule.exponential("1 second", 2).pipe(
      Schedule.jittered,
      Schedule.intersect(Schedule.recurs(10)),
    ),
  ),
)

// Pattern 3: Forever with capped exponential
const foreverWithBackoff = Schedule.exponential("1 second").pipe(
  Schedule.jittered,
  Schedule.delayed((d) => Duration.min(d, Duration.seconds(30))), // Cap at 30s
)
```

---

### 2. SubscriptionRef - Reactive State

A `SubscriptionRef<A>` is a `Ref` that can be subscribed to in order to receive the current value as well as all changes to that value.

#### Key Properties

- **It's a Ref** - Can `get`, `set`, `update` like normal Ref
- **It's subscribable** - Has a `.changes` Stream that emits current value + all updates
- **Multiple subscribers** - Many consumers can subscribe to same ref
- **Backpressure** - Stream semantics with proper backpressure

#### Interface

```typescript
interface SubscriptionRef<A> extends SynchronizedRef<A> {
  // Current value + all future changes as a Stream
  readonly changes: Stream.Stream<A>
}
```

#### Key Operations

```typescript
import { SubscriptionRef, Effect, Stream } from "effect"

// Create
const ref = yield * SubscriptionRef.make({ volume: 50, muted: false })

// Read current value
const current = yield * SubscriptionRef.get(ref)

// Update value (notifies all subscribers)
yield * SubscriptionRef.set(ref, { volume: 75, muted: false })
yield * SubscriptionRef.update(ref, (state) => ({ ...state, muted: true }))

// Subscribe to changes
const subscription = ref.changes.pipe(
  Stream.tap((value) => Effect.log(`State changed: ${JSON.stringify(value)}`)),
  Stream.runDrain,
  Effect.fork,
)
```

#### Use Case for Process Manager

```typescript
// Monitor state
interface MonitorState {
  status: "running" | "stopped" | "restarting" | "failed"
  lastError?: string
  restartCount: number
  lastHeartbeat: Date
}

// Create reactive state for each monitor
const audioState =
  yield
  * SubscriptionRef.make<MonitorState>({
    status: "stopped",
    restartCount: 0,
    lastHeartbeat: new Date(),
  })

// UI component subscribes to changes
audioState.changes.pipe(
  Stream.tap((state) => updateUI(state)),
  Stream.runDrain,
  Effect.fork,
)

// Monitor updates state
yield
  * SubscriptionRef.update(audioState, (s) => ({
    ...s,
    status: "running",
    lastHeartbeat: new Date(),
  }))
```

---

### 3. PubSub - Event Broadcasting

A `PubSub<A>` is an asynchronous message hub where publishers can publish messages and multiple subscribers can receive them.

#### Variants

- `PubSub.bounded(capacity)` - Backpressure when full
- `PubSub.unbounded()` - No limit (use carefully)
- `PubSub.dropping(capacity)` - Drops NEW messages when full
- `PubSub.sliding(capacity)` - Drops OLD messages when full

#### Interface

```typescript
// Publish
yield * PubSub.publish(pubsub, message)
yield * PubSub.publishAll(pubsub, [msg1, msg2])

// Subscribe (returns a Queue)
const subscription = yield * PubSub.subscribe(pubsub)
const message = yield * Queue.take(subscription)

// Or as Stream
const messageStream = Stream.fromQueue(subscription)
```

#### Use Case: Log Events

```typescript
interface LogEvent {
  timestamp: Date
  level: "debug" | "info" | "warn" | "error"
  source: "audio" | "network" | "system"
  message: string
}

const logPubSub = yield * PubSub.sliding<LogEvent>(1000)

// Multiple subscribers
// 1. File logger
PubSub.subscribe(logPubSub).pipe(
  Effect.flatMap((queue) =>
    Stream.fromQueue(queue).pipe(
      Stream.map(formatLogLine),
      Stream.run(fileSink),
    ),
  ),
  Effect.fork,
)

// 2. TUI display
PubSub.subscribe(logPubSub).pipe(
  Effect.flatMap((queue) =>
    Stream.fromQueue(queue).pipe(
      Stream.filter((e) => e.level !== "debug"),
      Stream.tap(displayInTUI),
      Stream.runDrain,
    ),
  ),
  Effect.fork,
)
```

#### SubscriptionRef vs PubSub

| Feature         | SubscriptionRef         | PubSub                                  |
| --------------- | ----------------------- | --------------------------------------- |
| State           | Single current value    | No state, just events                   |
| Subscribers get | Current value + changes | Only new messages                       |
| Use for         | Reactive state          | Event streams                           |
| Backpressure    | Stream-based            | Configurable (bounded/sliding/dropping) |

**For DaemonManager:**

- `SubscriptionRef` for daemon state (status, health)
- `PubSub` for log events (multiple consumers, sliding window)

---

### 4. Layer & Service - Dependency Injection

A `Layer<ROut, E, RIn>` describes how to build services. Layers are recipes for producing bundles of services given their dependencies.

#### Defining a Service

```typescript
import { Effect, PubSub, Stream, SubscriptionRef } from "effect"

// Using Effect.Service (Effect 3.9+)
// Combines Tag + Layer definition in one step
class DaemonManager extends Effect.Service<DaemonManager>()("DaemonManager", {
  effect: Effect.gen(function* () {
    // Initialize resources
    const configs = new Map<string, DaemonConfig>()
    const states = new Map<
      string,
      SubscriptionRef.SubscriptionRef<DaemonState>
    >()
    const fibers = new Map<string, Fiber.Fiber<void>>()
    const logPubSub = yield* PubSub.sliding<LogEvent>(1000)

    return {
      register: (name, config) =>
        Effect.sync(() => {
          configs.set(name, config)
        }),

      start: (name) =>
        Effect.gen(function* () {
          // Implementation: spawn process, monitor, handle restarts
        }),

      stop: (name) =>
        Effect.gen(function* () {
          // Implementation: send SIGTERM, update state
        }),

      restart: (name) =>
        Effect.gen(function* () {
          // Implementation: stop then start
        }),

      getState: (name) =>
        Effect.gen(function* () {
          // Implementation: read from SubscriptionRef
        }),

      subscribe: (name) => {
        // Return SubscriptionRef.changes stream
      },

      getOutput: (name) => {
        // Return stdout stream for daemon
      },

      logs: () => Stream.fromPubSub(logPubSub),
    }
  }),
}) {}

// Usage:
// - DaemonManager (the Tag) - use to access the service
// - DaemonManager.Default (the Layer) - use to provide the service

// Accessing the service in a program:
const program = Effect.gen(function* () {
  const dm = yield* DaemonManager
  yield* dm.start("audio")
})

// Providing the layer at the edge:
program.pipe(Effect.provide(DaemonManager.Default))
```

#### Layer Retry

Layers can be retried on construction failure:

```typescript
const RobustDaemonManager = DaemonManager.Default.pipe(
  Layer.retry(
    Schedule.exponential("1 second").pipe(
      Schedule.jittered,
      Schedule.recurs(5),
    ),
  ),
)
```

#### Composing Layers

```typescript
import { Layer } from "effect"

// Merge independent layers
const AppLayer = Layer.merge(DaemonManager.Default, LoggerLive, ConfigLive)

// Provide to program
const program = Effect.gen(function* () {
  const dm = yield* DaemonManager
  yield* dm.start("audio")
}).pipe(Effect.provide(AppLayer))
```

---

### 5. Logger - Structured Logging

Effect has a built-in Logger system with structured logging, levels, and customization.

#### Log Levels

```typescript
import { Effect, LogLevel } from "effect"

yield * Effect.logDebug("Debug message")
yield * Effect.logInfo("Info message")
yield * Effect.log("Default info message")
yield * Effect.logWarning("Warning message")
yield * Effect.logError("Error message")
yield * Effect.logFatal("Fatal message")
```

#### Logger Interface

```typescript
interface Logger<Message, Output> {
  log(options: {
    fiberId: FiberId
    logLevel: LogLevel
    message: Message
    cause: Cause<unknown>
    context: FiberRefs
    spans: List<LogSpan>
    annotations: HashMap<string, unknown>
    date: Date
  }): Output
}
```

#### Built-in Loggers

```typescript
Logger.defaultLogger // Console with colors
Logger.stringLogger // Simple string output
Logger.logfmtLogger // Key=value format
Logger.jsonLogger // JSON format
Logger.none // Discard all logs
```

#### Custom Logger

```typescript
const customLogger = Logger.make(({ logLevel, message, date, annotations }) => {
  const source = annotations.get("source") ?? "unknown"
  console.log(
    `[${date.toISOString()}] [${logLevel.label}] [${source}] ${message}`,
  )
})

// Use custom logger
const program = Effect.log("Hello").pipe(
  Effect.annotateLogs("source", "audio"),
  Effect.provide(Logger.replace(Logger.defaultLogger, customLogger)),
)
```

#### Set Minimum Log Level

```typescript
import { Logger, LogLevel } from "effect"

const program = Effect.gen(function* () {
  yield* Effect.logDebug("won't show")
  yield* Effect.logInfo("will show")
}).pipe(Logger.withMinimumLogLevel(LogLevel.Info))
```

#### File Logging with @effect/platform

```typescript
import { PlatformLogger } from "@effect/platform"
import { BunFileSystem } from "@effect/platform-bun"
import { Effect, Layer, Logger } from "effect"

// Create file logger
const fileLogger = Logger.logfmtLogger.pipe(
  PlatformLogger.toFile("/var/log/app.log"),
)

// Replace default logger (scoped - manages file handle)
const LoggerLive = Logger.replaceScoped(Logger.defaultLogger, fileLogger).pipe(
  Layer.provide(BunFileSystem.layer),
)
```

#### Dual Logging (Console + File)

```typescript
// Log to both console and file
const dualLogger = Logger.zip(
  Logger.defaultLogger, // Console
  fileLogger, // File
)

const LoggerLive = Logger.replaceScoped(Logger.defaultLogger, dualLogger)
```

---

### 6. Stream - Processing Subprocess Output

Streams represent potentially infinite sequences of values with backpressure.

#### From Subprocess (using @effect/platform)

```typescript
import { Command } from "@effect/platform"
import { Effect, Stream } from "effect"

const monitorStream = Command.make("pactl", "subscribe").pipe(
  Command.stream,
  Stream.decodeText(),
  Stream.splitLines,
  Stream.filter((line) => line.startsWith("Event")),
  Stream.map(parseEvent),
)
```

#### Stream Retry

```typescript
// Retry entire stream on failure
const robustStream = monitorStream.pipe(
  Stream.retry(
    Schedule.exponential("1 second").pipe(
      Schedule.jittered,
      Schedule.recurs(10),
    ),
  ),
)
```

#### Running Streams

```typescript
// Run to completion, collecting results
const results = yield * Stream.runCollect(stream)

// Run for side effects only
yield * Stream.runDrain(stream)

// Run as background fiber
const fiber = yield * stream.pipe(Stream.runDrain, Effect.fork)
```

---

### 7. Effect.retry vs Effect.repeat

**`Effect.retry`** - For failures, retry until success

```typescript
// Retry failed effect with schedule
const result =
  yield
  * Effect.retry(
    failingEffect,
    Schedule.exponential("1 second").pipe(Schedule.recurs(5)),
  )

// With options
const result =
  yield
  * Effect.retry(failingEffect, {
    times: 5,
    until: (error) => error.isRecoverable,
  })
```

**`Effect.repeat`** - For successes, repeat execution (daemon-like)

```typescript
// Repeat successful effect
const daemon = Effect.repeat(pollForUpdates, Schedule.fixed("1 second"))

// Fork as background daemon
yield * Effect.forkDaemon(daemon)
```

---

## DaemonManager Types

### DaemonConfig

```typescript
import { Duration } from "effect"

type DaemonName = string

interface DaemonConfig {
  /** Command to run: [executable, ...args] */
  command: readonly [string, ...string[]]
  /** Restart policy configuration */
  restartPolicy: RestartPolicy
  /** Whether to capture stdout for consumer processing (default: false) */
  captureOutput?: boolean
}

interface RestartPolicy {
  /** Base delay for exponential backoff (e.g., "1 second") */
  baseDelay: Duration.DurationInput
  /** Maximum delay cap (e.g., "30 seconds") */
  maxDelay?: Duration.DurationInput
  /** Maximum restart attempts (undefined = infinite) */
  maxAttempts?: number
  /** Add jitter to prevent thundering herd (default: true) */
  jitter?: boolean
}
```

### DaemonState

```typescript
interface DaemonState {
  /** Current daemon status */
  status: "running" | "stopped" | "restarting" | "failed"
  /** Number of times daemon has been restarted */
  restartCount: number
  /** Last error message if any */
  lastError?: string
  /** When the daemon was last started */
  startedAt?: Date
}
```

**Status transitions:**

```
          start()
stopped ─────────► running
    ▲                 │
    │                 │ crash
    │                 ▼
    │            restarting ──► (after delay) ──► running
    │                 │
    │                 │ maxAttempts exhausted
    │                 ▼
    └───────────── failed
         stop()
```

### LogEvent

```typescript
interface LogEvent {
  timestamp: Date
  level: "debug" | "info" | "warn" | "error"
  daemon: DaemonName
  message: string
}
```

### DaemonError

```typescript
import { Data } from "effect"

class DaemonError extends Data.TaggedError("DaemonError")<{
  readonly daemon: DaemonName
  readonly reason:
    | "not_found"
    | "already_running"
    | "start_failed"
    | "max_restarts"
  readonly message: string
}> {}
```

---

## DaemonManager Service Interface

```typescript
import { Effect, Stream } from "effect"

interface DaemonManager {
  // Registration (static config or dynamic)
  readonly register: (
    name: DaemonName,
    config: DaemonConfig,
  ) => Effect.Effect<void>

  // Lifecycle
  readonly start: (name: DaemonName) => Effect.Effect<void, DaemonError>
  readonly stop: (name: DaemonName) => Effect.Effect<void>
  readonly restart: (name: DaemonName) => Effect.Effect<void, DaemonError>

  // Status
  readonly getState: (
    name: DaemonName,
  ) => Effect.Effect<DaemonState, DaemonError>
  readonly subscribe: (
    name: DaemonName,
  ) => Stream.Stream<DaemonState, DaemonError>

  // Output (for daemons with captureOutput: true)
  // Single consumer per daemon - use Stream (pull-based)
  readonly getOutput: (name: DaemonName) => Stream.Stream<string, DaemonError>

  // Logs (multiple consumers - uses PubSub internally)
  readonly logs: () => Stream.Stream<LogEvent>

  // Management
  readonly listDaemons: () => Effect.Effect<DaemonName[]>
  readonly unregister: (name: DaemonName) => Effect.Effect<void>
}
```

### Behavioral Notes

| Method          | Behavior                                                       |
| --------------- | -------------------------------------------------------------- |
| `start()`       | **Idempotent** - if already running, returns success (no-op)   |
| `stop()`        | Sends SIGTERM to process, updates state to "stopped"           |
| `restart()`     | Equivalent to `stop()` then `start()`                          |
| `getState()`    | Returns current state snapshot                                 |
| `subscribe()`   | Returns Stream of state changes (current + future)             |
| `getOutput()`   | Returns Stream of stdout lines (only if `captureOutput: true`) |
| `logs()`        | Returns Stream from internal PubSub (multiple consumers OK)    |
| `listDaemons()` | Returns array of all registered daemon names                   |
| `unregister()`  | Stops daemon if running, then removes from registry            |

---

## RestartPolicy → Schedule Builder

```typescript
import { Duration, Schedule } from "effect"

const buildSchedule = (policy: RestartPolicy) => {
  let schedule = Schedule.exponential(policy.baseDelay)

  // Add jitter by default to prevent thundering herd
  if (policy.jitter !== false) {
    schedule = schedule.pipe(Schedule.jittered)
  }

  // Cap maximum delay
  if (policy.maxDelay) {
    const maxDelay = Duration.decode(policy.maxDelay)
    schedule = Schedule.delayed(schedule, (d) => Duration.min(d, maxDelay))
  }

  // Limit restart attempts
  if (policy.maxAttempts !== undefined) {
    schedule = schedule.pipe(
      Schedule.intersect(Schedule.recurs(policy.maxAttempts)),
    )
  }

  return schedule
}
```

### Common Restart Policies

```typescript
// Conservative: Fast retries with cap, give up after 10 attempts
const conservative: RestartPolicy = {
  baseDelay: "1 second",
  maxDelay: "30 seconds",
  maxAttempts: 10,
  jitter: true,
}

// Persistent: Never give up, but back off
const persistent: RestartPolicy = {
  baseDelay: "1 second",
  maxDelay: "1 minute",
  maxAttempts: undefined, // infinite
  jitter: true,
}

// Aggressive: Quick restarts for critical services
const aggressive: RestartPolicy = {
  baseDelay: "100 millis",
  maxDelay: "5 seconds",
  maxAttempts: 20,
  jitter: true,
}
```

---

## Implementation Steps

### Phase 1: Core DaemonManager

1. Create `src/lib/daemon-manager.ts`
2. Define types: `DaemonConfig`, `DaemonState`, `DaemonError`, `LogEvent`
3. Implement `buildSchedule()` from `RestartPolicy`
4. Create `DaemonManager` service using `Effect.Service`
5. Implement internal state management:
   - `MutableHashMap<DaemonName, DaemonInternals>` for all daemon state
   - `PubSub<LogEvent>` for centralized logging

### Phase 2: Process Lifecycle

1. Implement `register()` - store daemon config
2. Implement `start()`:
   - Use `Command.make()` to create process
   - Use `Command.start()` to launch
   - Fork a fiber that monitors the process
   - On exit, check if intentional stop or crash
   - If crash, update state to "restarting" and use `Effect.retry` with schedule
3. Implement `stop()`:
   - Send SIGTERM to process
   - Update state to "stopped"
   - Interrupt the monitoring fiber
4. Implement `restart()` - `stop()` then `start()`

### Phase 3: Output Streaming

1. For daemons with `captureOutput: true`:
   - Pipe process stdout to a Stream
   - Use `Command.streamLines()` for line-based output
2. Implement `getOutput()`:
   - Return the stdout Stream for the daemon
   - Stream is single-consumer (pull-based)

### Phase 4: Status & Logging

1. Implement `getState()` - read from SubscriptionRef
2. Implement `subscribe()` - return SubscriptionRef.changes
3. Implement `logs()` - subscribe to PubSub as Stream
4. Add logging throughout lifecycle (start, stop, crash, restart)

### Phase 5: Integration

1. Add DaemonManager to app runtime layer
2. Create domain services (Audio, Network) that use DaemonManager
3. Update UI components to use domain services
4. Clean up old callback-based code

---

## Future Possibilities

### Domain Services

Build high-level services on top of DaemonManager:

```typescript
// Network Service - uses DaemonManager internally
class Network extends Effect.Service<Network>()("Network", {
  effect: Effect.gen(function* () {
    const dm = yield* DaemonManager

    // Register and start the daemon
    yield* dm.register("network", {
      command: ["nmcli", "monitor"],
      restartPolicy: { baseDelay: "1 second", maxDelay: "30 seconds" },
      captureOutput: true,
    })
    yield* dm.start("network")

    // State management
    const state = yield* SubscriptionRef.make<NetworkState>({ ... })
    const events = yield* PubSub.sliding<NetworkEvent>(100)

    // Process daemon output
    yield* dm.getOutput("network").pipe(
      Stream.map(parseMonitorLine),
      Stream.filter((e) => e !== null),
      Stream.tap((event) => handleEvent(event, state, events)),
      Stream.runDrain,
      Effect.fork,
    )

    // Signal polling
    yield* pipe(
      readWifiSignal(),
      Effect.tap((signal) => SubscriptionRef.update(state, (s) => ({ ...s, signal }))),
      Effect.repeat(Schedule.spaced("1 second")),
      Effect.fork,
    )

    return {
      state: state.changes,
      events: Stream.fromPubSub(events),
      getStatus: () => SubscriptionRef.get(state),
    }
  }),
  dependencies: [DaemonManager.Default],
}) {}
```

### Additional Daemons

- `swww-daemon` / `wbg` - Wallpaper daemon
- Notification daemon (dunst, mako, etc.)
- Status bar daemon
- Clipboard manager

### TUI Log Display

- Subscribe to `DaemonManager.logs()` stream
- Display in a scrollable log panel
- Filter by daemon/level

### Health Dashboard

- Show all daemon states
- Visual indicator (green/yellow/red)
- Restart count and uptime

### Enhanced Features (v2)

- `startAll()` / `stopAll()` - batch operations
- Dependency ordering (start A before B)
- Graceful shutdown with SIGTERM → SIGKILL timeout
- Resource monitoring (optional)

---

## Complete Implementation

This is the full implementation for `src/lib/daemon-manager.ts`. Copy this file and adapt as needed.

```typescript
import { Command } from "@effect/platform"
import type { PlatformError } from "@effect/platform/Error"
import {
  Data,
  Duration,
  Effect,
  Fiber,
  MutableHashMap,
  Option,
  pipe,
  PubSub,
  Queue,
  Schedule,
  Stream,
  SubscriptionRef,
} from "effect"

// =============================================================================
// Types
// =============================================================================

/** Unique identifier for a daemon */
export type DaemonName = string

/** Restart policy configuration */
export interface RestartPolicy {
  /** Base delay for exponential backoff (e.g., "1 second") */
  readonly baseDelay: Duration.DurationInput
  /** Maximum delay cap (e.g., "30 seconds") */
  readonly maxDelay?: Duration.DurationInput
  /** Maximum restart attempts (undefined = infinite) */
  readonly maxAttempts?: number
  /** Add jitter to prevent thundering herd (default: true) */
  readonly jitter?: boolean
}

/** Configuration for a daemon */
export interface DaemonConfig {
  /** Command to run: [executable, ...args] */
  readonly command: readonly [string, ...string[]]
  /** Restart policy configuration */
  readonly restartPolicy: RestartPolicy
  /** Whether to capture stdout for consumer processing (default: false) */
  readonly captureOutput?: boolean
}

/** Current state of a daemon */
export interface DaemonState {
  /** Current daemon status */
  readonly status: "running" | "stopped" | "restarting" | "failed"
  /** Number of times daemon has been restarted */
  readonly restartCount: number
  /** Last error message if any */
  readonly lastError?: string
  /** When the daemon was last started */
  readonly startedAt?: Date
}

/** Log event from daemon manager */
export interface LogEvent {
  readonly timestamp: Date
  readonly level: "debug" | "info" | "warn" | "error"
  readonly daemon: DaemonName
  readonly message: string
}

/** Errors that can occur in daemon management */
export class DaemonError extends Data.TaggedError("DaemonError")<{
  readonly daemon: DaemonName
  readonly reason:
    | "not_found"
    | "already_running"
    | "start_failed"
    | "max_restarts"
  readonly message: string
}> {}

// =============================================================================
// Schedule Builder
// =============================================================================

/**
 * Builds a Schedule from a RestartPolicy configuration.
 *
 * The schedule determines the delay between restart attempts:
 * - Uses exponential backoff starting from baseDelay
 * - Optionally adds jitter to prevent thundering herd
 * - Optionally caps the maximum delay
 * - Optionally limits the number of restart attempts
 */
export const buildSchedule = (
  policy: RestartPolicy,
): Schedule.Schedule<unknown> => {
  // Start with exponential backoff
  let schedule: Schedule.Schedule<Duration.Duration> = Schedule.exponential(
    policy.baseDelay,
  )

  // Add jitter by default (varies delay 80%-120%)
  if (policy.jitter !== false) {
    schedule = Schedule.jittered(schedule)
  }

  // Cap maximum delay if specified
  if (policy.maxDelay !== undefined) {
    const maxDelay = Duration.decode(policy.maxDelay)
    schedule = Schedule.map(schedule, (d) => Duration.min(d, maxDelay))
  }

  // Limit restart attempts if specified
  if (policy.maxAttempts !== undefined) {
    // intersect ensures both conditions must be met:
    // - exponential delay AND still within max attempts
    return pipe(
      schedule,
      Schedule.intersect(Schedule.recurs(policy.maxAttempts)),
    )
  }

  return schedule
}

// =============================================================================
// Internal State Types
// =============================================================================

/** Internal state for a running daemon */
interface DaemonInternals {
  readonly config: DaemonConfig
  readonly stateRef: SubscriptionRef.SubscriptionRef<DaemonState>
  readonly outputQueue: Queue.Queue<string> | null
  fiber: Fiber.RuntimeFiber<void, PlatformError | DaemonError> | null
  intentionalStop: boolean
}

// =============================================================================
// DaemonManager Service
// =============================================================================

export class DaemonManager extends Effect.Service<DaemonManager>()(
  "DaemonManager",
  {
    effect: Effect.gen(function* () {
      // Internal state - using MutableHashMap (Effect-idiomatic, returns Option)
      const daemons = MutableHashMap.empty<DaemonName, DaemonInternals>()
      const logPubSub = yield* PubSub.sliding<LogEvent>(1000)

      // ---------------------------------------------------------------------
      // Helper: Get daemon internals (returns Option)
      // ---------------------------------------------------------------------
      const getDaemon = (name: DaemonName): Option.Option<DaemonInternals> =>
        MutableHashMap.get(daemons, name)

      // ---------------------------------------------------------------------
      // Helper: Publish a log event
      // ---------------------------------------------------------------------
      const log = (
        daemon: DaemonName,
        level: LogEvent["level"],
        message: string,
      ): Effect.Effect<void> =>
        PubSub.publish(logPubSub, {
          timestamp: new Date(),
          level,
          daemon,
          message,
        }).pipe(Effect.asVoid)

      // ---------------------------------------------------------------------
      // Helper: Update daemon state
      // ---------------------------------------------------------------------
      const updateState = (
        name: DaemonName,
        update: (state: DaemonState) => DaemonState,
      ): Effect.Effect<void> =>
        Effect.gen(function* () {
          const maybeInternals = getDaemon(name)
          if (Option.isSome(maybeInternals)) {
            yield* SubscriptionRef.update(maybeInternals.value.stateRef, update)
          }
        })

      // ---------------------------------------------------------------------
      // Helper: Run the daemon process with restart logic
      // ---------------------------------------------------------------------
      const runDaemon = (
        name: DaemonName,
      ): Effect.Effect<void, PlatformError | DaemonError> =>
        Effect.gen(function* () {
          const maybeInternals = getDaemon(name)
          if (Option.isNone(maybeInternals)) {
            return yield* new DaemonError({
              daemon: name,
              reason: "not_found",
              message: `Daemon "${name}" is not registered`,
            })
          }

          const internals = maybeInternals.value
          const { config, outputQueue } = internals
          const schedule = buildSchedule(config.restartPolicy)

          // The main daemon loop - runs and restarts on failure
          yield* Effect.gen(function* () {
            // Update state to running
            yield* updateState(name, (s) => ({
              ...s,
              status: "running" as const,
              startedAt: new Date(),
            }))
            yield* log(
              name,
              "info",
              `Starting daemon: ${config.command.join(" ")}`,
            )

            // Spawn the process
            const process = yield* Command.make(...config.command).pipe(
              Command.start,
            )

            // If capturing output, pipe stdout to the queue
            if (outputQueue) {
              yield* pipe(
                process.stdout,
                Stream.decodeText(),
                Stream.splitLines,
                Stream.runForEach((line) => Queue.offer(outputQueue, line)),
                Effect.fork,
              )
            }

            // Wait for process to exit
            const exitCode = yield* process.exitCode

            // Check if this was an intentional stop
            if (internals.intentionalStop) {
              yield* log(name, "info", "Daemon stopped intentionally")
              return // Don't throw, don't restart
            }

            // Process exited unexpectedly
            yield* log(name, "warn", `Daemon exited with code ${exitCode}`)

            // Throw to trigger retry
            return yield* Effect.fail(
              new DaemonError({
                daemon: name,
                reason: "start_failed",
                message: `Process exited with code ${exitCode}`,
              }),
            )
          }).pipe(
            Effect.scoped,
            // Retry with the configured schedule
            Effect.retry({
              schedule,
              while: () => {
                // Don't retry if intentionally stopped
                if (internals.intentionalStop) return false
                // Don't retry if daemon was unregistered
                if (Option.isNone(getDaemon(name))) return false
                return true
              },
            }),
            // Before each retry, update state to "restarting"
            Effect.tapErrorCause(() =>
              Effect.gen(function* () {
                if (!internals.intentionalStop) {
                  yield* updateState(name, (s) => ({
                    ...s,
                    status: "restarting" as const,
                    restartCount: s.restartCount + 1,
                  }))
                  yield* log(name, "info", "Restarting daemon...")
                }
              }),
            ),
            // If all retries exhausted, mark as failed
            Effect.catchAll((error) =>
              Effect.gen(function* () {
                if (!internals.intentionalStop) {
                  yield* updateState(name, (s) => ({
                    ...s,
                    status: "failed" as const,
                    lastError:
                      error instanceof DaemonError ?
                        error.message
                      : String(error),
                  }))
                  yield* log(name, "error", `Daemon failed: ${error}`)
                }
              }),
            ),
          )
        })

      // =====================================================================
      // Public API
      // =====================================================================

      return {
        /**
         * Register a daemon configuration.
         * Does not start the daemon - call start() after registering.
         */
        register: (
          name: DaemonName,
          config: DaemonConfig,
        ): Effect.Effect<void> =>
          Effect.gen(function* () {
            const maybeExisting = getDaemon(name)
            if (Option.isSome(maybeExisting)) {
              // Already registered, update config
              MutableHashMap.set(daemons, name, {
                ...maybeExisting.value,
                config,
              })
              yield* log(name, "debug", "Daemon config updated")
              return
            }

            // Create initial state
            const stateRef = yield* SubscriptionRef.make<DaemonState>({
              status: "stopped",
              restartCount: 0,
            })

            // Create output queue if capturing output
            const outputQueue =
              config.captureOutput ? yield* Queue.unbounded<string>() : null

            MutableHashMap.set(daemons, name, {
              config,
              stateRef,
              outputQueue,
              fiber: null,
              intentionalStop: false,
            })

            yield* log(name, "info", "Daemon registered")
          }),

        /**
         * Start a registered daemon.
         * Idempotent - if already running, returns success.
         */
        start: (name: DaemonName): Effect.Effect<void, DaemonError> =>
          Effect.gen(function* () {
            const maybeInternals = getDaemon(name)
            if (Option.isNone(maybeInternals)) {
              return yield* new DaemonError({
                daemon: name,
                reason: "not_found",
                message: `Daemon "${name}" is not registered`,
              })
            }

            const internals = maybeInternals.value

            // Check if already running
            const currentState = yield* SubscriptionRef.get(internals.stateRef)
            if (
              currentState.status === "running"
              || currentState.status === "restarting"
            ) {
              yield* log(name, "debug", "Daemon already running")
              return
            }

            // Reset intentional stop flag
            internals.intentionalStop = false

            // Fork the daemon runner
            const fiber = yield* Effect.fork(runDaemon(name))
            internals.fiber = fiber
          }),

        /**
         * Stop a running daemon.
         * Sends SIGTERM to the process.
         */
        stop: (name: DaemonName): Effect.Effect<void> =>
          Effect.gen(function* () {
            const maybeInternals = getDaemon(name)
            if (Option.isNone(maybeInternals)) return

            const internals = maybeInternals.value

            // Set intentional stop flag to prevent restarts
            internals.intentionalStop = true

            // Interrupt the daemon fiber (this will kill the process)
            if (internals.fiber) {
              yield* Fiber.interrupt(internals.fiber)
              internals.fiber = null
            }

            // Update state
            yield* updateState(name, (s) => ({
              ...s,
              status: "stopped" as const,
            }))

            yield* log(name, "info", "Daemon stopped")
          }),

        /**
         * Restart a daemon (stop then start).
         */
        restart: (name: DaemonName): Effect.Effect<void, DaemonError> =>
          Effect.gen(function* () {
            const maybeInternals = getDaemon(name)
            if (Option.isNone(maybeInternals)) {
              return yield* new DaemonError({
                daemon: name,
                reason: "not_found",
                message: `Daemon "${name}" is not registered`,
              })
            }

            const internals = maybeInternals.value

            yield* log(name, "info", "Restarting daemon...")

            // Stop (don't yield the error, stop always succeeds)
            yield* Effect.gen(function* () {
              internals.intentionalStop = true
              if (internals.fiber) {
                yield* Fiber.interrupt(internals.fiber)
                internals.fiber = null
              }
            })

            // Reset state for fresh start
            yield* updateState(name, (s) => ({
              ...s,
              status: "stopped" as const,
              restartCount: 0, // Reset count on manual restart
              lastError: undefined,
            }))

            // Small delay to ensure cleanup
            yield* Effect.sleep("100 millis")

            // Start fresh
            internals.intentionalStop = false
            const fiber = yield* Effect.fork(runDaemon(name))
            internals.fiber = fiber
          }),

        /**
         * Get the current state of a daemon.
         */
        getState: (name: DaemonName): Effect.Effect<DaemonState, DaemonError> =>
          Effect.gen(function* () {
            const maybeInternals = getDaemon(name)
            if (Option.isNone(maybeInternals)) {
              return yield* new DaemonError({
                daemon: name,
                reason: "not_found",
                message: `Daemon "${name}" is not registered`,
              })
            }
            return yield* SubscriptionRef.get(maybeInternals.value.stateRef)
          }),

        /**
         * Subscribe to state changes for a daemon.
         * Returns current state immediately, then all future changes.
         */
        subscribe: (
          name: DaemonName,
        ): Stream.Stream<DaemonState, DaemonError> =>
          Stream.unwrap(
            Effect.gen(function* () {
              const maybeInternals = getDaemon(name)
              if (Option.isNone(maybeInternals)) {
                return Stream.fail(
                  new DaemonError({
                    daemon: name,
                    reason: "not_found",
                    message: `Daemon "${name}" is not registered`,
                  }),
                )
              }
              return maybeInternals.value.stateRef.changes
            }),
          ),

        /**
         * Get stdout output stream for a daemon.
         * Only works if daemon was registered with captureOutput: true.
         * Single consumer - use for processing daemon output.
         */
        getOutput: (name: DaemonName): Stream.Stream<string, DaemonError> =>
          Stream.unwrap(
            Effect.gen(function* () {
              const maybeInternals = getDaemon(name)
              if (Option.isNone(maybeInternals)) {
                return Stream.fail(
                  new DaemonError({
                    daemon: name,
                    reason: "not_found",
                    message: `Daemon "${name}" is not registered`,
                  }),
                )
              }
              const internals = maybeInternals.value
              if (!internals.outputQueue) {
                return Stream.fail(
                  new DaemonError({
                    daemon: name,
                    reason: "not_found",
                    message: `Daemon "${name}" was not configured with captureOutput: true`,
                  }),
                )
              }
              return Stream.fromQueue(internals.outputQueue)
            }),
          ),

        /**
         * Subscribe to log events from all daemons.
         * Multiple consumers supported.
         */
        logs: (): Stream.Stream<LogEvent> =>
          Stream.unwrapScoped(
            Effect.map(PubSub.subscribe(logPubSub), Stream.fromQueue),
          ),

        /**
         * Get all registered daemon names.
         */
        listDaemons: (): Effect.Effect<DaemonName[]> =>
          Effect.sync(() => MutableHashMap.keys(daemons)),

        /**
         * Unregister a daemon. Stops it first if running.
         */
        unregister: (name: DaemonName): Effect.Effect<void> =>
          Effect.gen(function* () {
            const maybeInternals = getDaemon(name)
            if (Option.isNone(maybeInternals)) return

            const internals = maybeInternals.value

            // Stop if running
            internals.intentionalStop = true
            if (internals.fiber) {
              yield* Fiber.interrupt(internals.fiber)
            }

            // Shutdown output queue if exists
            if (internals.outputQueue) {
              yield* Queue.shutdown(internals.outputQueue)
            }

            MutableHashMap.remove(daemons, name)
            yield* log(name, "info", "Daemon unregistered")
          }),
      }
    }),
  },
) {}

// =============================================================================
// Common Restart Policies
// =============================================================================

/** Conservative: Back off quickly, give up after 10 attempts */
export const conservativePolicy: RestartPolicy = {
  baseDelay: "1 second",
  maxDelay: "30 seconds",
  maxAttempts: 10,
  jitter: true,
}

/** Persistent: Never give up, but back off to avoid hammering */
export const persistentPolicy: RestartPolicy = {
  baseDelay: "1 second",
  maxDelay: "1 minute",
  maxAttempts: undefined,
  jitter: true,
}

/** Aggressive: Quick restarts for critical services */
export const aggressivePolicy: RestartPolicy = {
  baseDelay: "100 millis",
  maxDelay: "5 seconds",
  maxAttempts: 20,
  jitter: true,
}
```

---

## Usage Example

Here's how to use the DaemonManager in your app:

```typescript
import { Effect, Stream } from "effect"
import { DaemonManager, persistentPolicy } from "./lib/daemon-manager"

const program = Effect.gen(function* () {
  const dm = yield* DaemonManager

  // 1. Register daemons
  yield* dm.register("audio", {
    command: ["pactl", "subscribe"],
    restartPolicy: persistentPolicy,
    captureOutput: true,
  })

  yield* dm.register("network", {
    command: ["nmcli", "monitor"],
    restartPolicy: persistentPolicy,
    captureOutput: true,
  })

  // 2. Start daemons
  yield* dm.start("audio")
  yield* dm.start("network")

  // 3. Process audio output in background
  yield* dm.getOutput("audio").pipe(
    Stream.tap((line) => Effect.log(`[audio] ${line}`)),
    Stream.runDrain,
    Effect.fork,
  )

  // 4. Subscribe to state changes
  yield* dm.subscribe("audio").pipe(
    Stream.tap((state) =>
      Effect.log(
        `Audio daemon: ${state.status} (restarts: ${state.restartCount})`,
      ),
    ),
    Stream.runDrain,
    Effect.fork,
  )

  // 5. Watch all logs
  yield* dm.logs().pipe(
    Stream.tap((log) =>
      Effect.log(`[${log.daemon}] ${log.level}: ${log.message}`),
    ),
    Stream.runDrain,
    Effect.fork,
  )

  // Keep running...
  yield* Effect.never
})

// Provide DaemonManager layer and run
program.pipe(Effect.provide(DaemonManager.Default), Effect.runPromise)
```

---

## Integrating with AppRuntime

Update your `runtime.ts` to include DaemonManager:

```typescript
import { BunContext } from "@effect/platform-bun"
import { Layer, ManagedRuntime } from "effect"
import { DaemonManager } from "./daemon-manager"

// Combine layers
const AppLayer = Layer.merge(BunContext.layer, DaemonManager.Default)

export const AppRuntime = ManagedRuntime.make(AppLayer)
```

---

## Key Implementation Notes

### 1. Why `MutableHashMap` instead of JavaScript `Map`

We use Effect's `MutableHashMap` for internal state because:

- **Effect-idiomatic** - This is what Effect's own internal code uses (see `FiberMap`, `Cache`)
- **Safer API** - `.get()` returns `Option<V>` instead of `V | undefined`, forcing explicit null handling
- **Effect-aware** - Implements `Equal`, `Hash`, `Inspectable` interfaces

```typescript
// MutableHashMap pattern
const maybeInternals = MutableHashMap.get(daemons, name)
if (Option.isNone(maybeInternals)) {
  return yield* new DaemonError({ ... })
}
const internals = maybeInternals.value
```

Note: Services CAN hold internal mutable state - this is a common and accepted pattern in Effect (see `Cache`, `FiberMap` in Effect's source code with explicit `// mutable by design` comments).

### 2. Why `Effect.scoped` is inside the retry loop

The process lifecycle (`Command.start`) requires a scope. By placing `Effect.scoped` around just the process-running code (not the whole daemon), we ensure:

- Each restart attempt gets a fresh scope
- The scope closes when the process exits, cleaning up resources
- The retry logic operates outside the scope

### 3. How restart detection works

We use an `intentionalStop` flag:

- Set to `true` before calling `stop()` or during `unregister()`
- Checked in the retry `while` predicate
- Prevents restart when the stop was intentional

### 4. Output streaming with Queue

We use an unbounded `Queue` for output:

- Process stdout is split by lines and offered to the queue
- `getOutput()` returns a `Stream.fromQueue()`
- Single consumer model (queue items are taken, not broadcast)

If you need multiple consumers for output, you could change this to use a `PubSub` instead.

### 5. Logs use PubSub

Logs are broadcast via `PubSub.sliding(1000)`:

- Multiple subscribers can consume logs independently
- Sliding strategy means old logs are dropped if consumers are slow
- 1000 capacity provides reasonable buffer

### 6. State changes via SubscriptionRef

Each daemon has a `SubscriptionRef<DaemonState>`:

- `.changes` stream provides current value + all future updates
- Multiple UI components can subscribe independently
- Updates are atomic and immediately visible

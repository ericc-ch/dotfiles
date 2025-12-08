# Effect-TS Notes & Gotchas

## `Effect.scoped` Placement Matters

`Effect.scoped` creates a scope, runs the inner effect, and **closes the scope when that inner effect completes**.

**Wrong** — scope closes before `flatMap` runs:

```typescript
Command.start.pipe(
  Effect.scoped,        // Scope closes here, process gets killed
  Effect.flatMap(...)   // Runs AFTER scope is closed
)
```

**Correct** — scope stays open for the entire operation:

```typescript
Command.start.pipe(
  Effect.flatMap(...),  // Still needs Scope
  Effect.scoped,        // Scope closes after flatMap completes
)
```

Think of `Effect.scoped` like a `using` block — everything that needs the resource must be inside it.

---

## Streams and Process File Descriptor Inheritance

When spawning processes, child processes can **inherit file descriptors** (stdin, stdout, stderr) from the parent. If you read a stream like `process.stderr`, it won't close until **all processes holding that file descriptor exit**.

**Problem scenario:**

```typescript
// astal-apps spawns Helium Browser and exits in 21ms
// But Helium Browser inherits stderr file descriptor
// Stream.runFold on stderr waits for stream to close
// Stream only closes when Helium Browser exits!

Effect.all({
  exitCode: process.exitCode,      // Resolves in 21ms
  stderr: process.stderr.pipe(...) // Waits for browser to exit!
})
```

**Solution:** Only read stderr when needed (e.g., on failure):

```typescript
const exitCode = yield * process.exitCode // Returns immediately

if (exitCode !== 0) {
  // Only read stderr if there's an error
  const stderr =
    yield
    * process.stderr.pipe(
      Stream.decodeText(),
      Stream.runFold("", (acc, chunk) => acc + chunk),
    )
  yield * new CommandError({ command, exitCode, stderr })
}
```

---

## `Effect.fn` vs `Effect.gen`

- **`Effect.gen`** — Creates an Effect value (no arguments)
- **`Effect.fn`** — Creates a **function** that returns an Effect (takes arguments)

```typescript
// Effect.gen - for standalone effects
const myEffect = Effect.gen(function* () {
  const a = yield* someEffect
  return a + 1
})

// Effect.fn - for functions returning effects
const myFunction = Effect.fn(function* (name: string) {
  const a = yield* someEffect(name)
  return a + 1
})
```

`Effect.fn` also accepts pipeables as extra arguments:

```typescript
const launchApp = Effect.fn(
  function* (name: string) {
    const process = yield* Command.make("app", name).pipe(Command.start)
    // ...
  },
  Effect.scoped, // Wraps the entire generator's effect
)
```

---

## `TaggedError` is Already an Effect

Classes extending `Data.TaggedError` are both an Error AND an Effect that fails with itself:

```typescript
class MyError extends Data.TaggedError("MyError")<{ message: string }> {}

// These are equivalent:
yield * new MyError({ message: "boom" })
yield * Effect.fail(new MyError({ message: "boom" }))
```

No need to wrap in `Effect.fail()` — just `yield*` the error directly.

---

## `forkDaemon` vs `forkScoped` vs `forkIn` — Process Cleanup

When spawning long-running child processes (daemons), choosing the right fork method determines whether processes get cleaned up on shutdown.

### The Problem

`@effect/platform`'s `Command.start` spawns processes with `detached: true` on Linux. The process is only killed in the `acquireRelease` finalizer, which only runs when the **Scope closes**.

### Fork Methods Compared

| Method                  | Where fiber lives        | Cleaned up by `dispose()`?     |
| ----------------------- | ------------------------ | ------------------------------ |
| `forkDaemon`            | `globalScope` (detached) | ❌ NO — orphaned!              |
| `forkScoped`            | Caller's context scope   | ✅ Yes, IF caller has a Scope  |
| `forkIn(effect, scope)` | Specified scope          | ✅ Yes, when that scope closes |

### Why `forkDaemon` Doesn't Clean Up

`forkDaemon` explicitly detaches the fiber from ALL scopes:

```typescript
// Fiber goes to globalScope — no parent, no cleanup
yield * Effect.forkDaemon(spawnProcess)

// When ManagedRuntime.dispose() is called:
// - It closes ITS scope
// - globalScope fibers are NOT touched
// - Child process stays alive as orphan!
```

### Why `forkScoped` Often Fails

`forkScoped` looks for a Scope in the **current Effect context**:

```typescript
// Inside Effect.gen — but does it have a Scope?
const program = Effect.gen(function* () {
  yield* forkScoped(spawnProcess) // ❌ "Service not found: effect/Scope"
})

runtime.runPromise(program) // No Scope provided!
```

**Scope exists in context when:**

- Inside `Effect.scoped(...)` block
- Inside a `Layer.scoped` / `scoped:` service
- Explicitly provided

**Scope does NOT exist in:**

- Bare `Effect.gen(...)` without scoped wrapper
- Direct `runPromise(effect)` calls

### The Solution: `forkIn` with Captured Scope

Capture the scope during service initialization, use it later:

```typescript
class DaemonManager extends Effect.Service<DaemonManager>()(
  "DaemonManager",
  {
    scoped: Effect.gen(function* () {  // Layer.scoped provides a Scope!
      const scope = yield* Effect.scope  // Capture it

      const start = Effect.fn(function* (name: string) {
        const spawnDaemon = Effect.gen(function* () {
          const proc = yield* Command.make("my-daemon").pipe(Command.start)
          yield* proc.exitCode  // Wait for process
        }).pipe(Effect.scoped)

        // Fork into the CAPTURED scope, not caller's context
        yield* Effect.forkIn(spawnDaemon, scope)
      })

      return { start }
    }),
  },
)
```

**How it works:**

1. `scoped:` creates a Layer that provides a Scope tied to ManagedRuntime
2. `yield* Effect.scope` captures that scope as a variable
3. `forkIn(effect, scope)` forks into that specific scope
4. When `runtime.dispose()` closes, the service's scope closes
5. Fibers in that scope are interrupted
6. `Command.start`'s finalizer runs `killProcessGroup(-pid)`
7. Child process is properly terminated

### Key Insight

The child process cleanup happens in `Command.start`'s `acquireRelease` finalizer. That finalizer ONLY runs when:

1. The fiber is interrupted, AND
2. The `Effect.scoped` wrapper's scope closes

With `forkDaemon`, the fiber is never interrupted by `dispose()`, so the finalizer never runs.

### Why Even SIGTERM Doesn't Help

Even if you use `BunRuntime.runMain` (which installs SIGTERM/SIGINT handlers), daemon fibers still won't be cleaned up:

```typescript
// runMain's signal handler:
function onSigint() {
  fiber.unsafeInterruptAsFork(fiber.id()) // Only interrupts THE main fiber
}
```

The problem:

1. **`runMain`'s signal handler only interrupts the main fiber**
2. **`forkDaemon` fibers live in global scope** — they're siblings of the main fiber, not children
3. **Global scope has no `close()` mechanism** — it's a singleton that lives until process termination
4. **Process exits before finalizers can run** → child processes become orphans

```
Main Fiber (interrupted on SIGTERM)
  └── Your app logic (children get interrupted)

Global Scope (NOT cleaned up by anyone)
  └── Daemon Fiber 1 (orphaned!)
  └── Daemon Fiber 2 (orphaned!)
```

**Without `runMain`** (e.g., opentui setup with `AppRuntime.runFork`), it's even worse — there's no signal handler at all, so SIGTERM just kills the process immediately with no cleanup.

**Bottom line:** `forkDaemon` means "I will manually manage this fiber's lifecycle" — don't use it for processes that need cleanup on app shutdown.

---

## Layer MemoMap — Sharing State Between Runtimes

When using both `ManagedRuntime` and `Atom.runtime()`, each creates its own **MemoMap** — an internal cache for built layers. This means the same layer gets built **twice**, creating separate service instances with separate state.

```typescript
// These use DIFFERENT MemoMaps internally:
const AppRuntime = ManagedRuntime.make(AppLayer) // MemoMap A
const AppAtom = Atom.runtime(AppLayer) // MemoMap B

// Result: Two separate DaemonManager instances with separate state!
```

### Solution: Share `Atom.runtime.memoMap`

```typescript
const AppLayer = Layer.merge(DaemonManager.Default, BunContext.layer)

// Pass Atom.runtime's memoMap to ManagedRuntime
export const AppRuntime = ManagedRuntime.make(AppLayer, Atom.runtime.memoMap)
export const AtomRuntime = Atom.runtime(AppLayer)

// Now both share the same service instances
```

**Alternative:** Create your own shared memoMap with `Effect.runSync(Layer.makeMemoMap)` and pass it to both.

### When You Need This

- Using `@effect-atom/atom` alongside `ManagedRuntime`
- Services with internal mutable state (`MutableHashMap`, `Ref`, etc.)
- Multiple Effect "entry points" that need to share service instances

---

## `MutableHashMap` Returns `Option`

Effect-idiomatic mutable collections return `Option`, forcing explicit null handling instead of `undefined`:

```typescript
const maybeInternals = MutableHashMap.get(daemons, name)
if (Option.isNone(maybeInternals)) {
  return yield * new DaemonNotFound({ daemon: name })
}
const internals = maybeInternals.value
```

---

## `Effect.scoped` Inside Retry Loops

When retrying scoped resources (like processes), scope must be **inside** the retry — each attempt needs a fresh scope:

```typescript
// Correct: each retry gets fresh scope
Effect.gen(function* () {
  const process = yield* Command.start(cmd)
  yield* process.exitCode
}).pipe(
  Effect.scoped, // Scope closes per attempt
  Effect.retry(schedule),
)
```

---

## Separate `TaggedError` Classes for `catchTags`

Use individual error classes instead of a union with `_tag` property — enables clean `catchTags` pattern matching:

```typescript
class DaemonNotFound extends Data.TaggedError("DaemonNotFound")<{
  daemon: string
}> {}
class DaemonStartFailed extends Data.TaggedError("DaemonStartFailed")<{
  daemon: string
  exitCode: number
}> {}

// Clean error handling
yield
  * dm.start("audio").pipe(
    Effect.catchTags({
      DaemonNotFound: (e) => Effect.log(`${e.daemon} not registered`),
      DaemonStartFailed: (e) => Effect.log(`Exit code ${e.exitCode}`),
    }),
  )
```

---

## `Schedule.intersect` for AND Conditions

Combine schedules where **both** must allow continuation (uses longer delay):

```typescript
// Exponential backoff AND max 10 attempts
Schedule.exponential("1 second").pipe(
  Schedule.jittered,
  Schedule.intersect(Schedule.recurs(10)),
)
```

---

## `SubscriptionRef` vs `PubSub`

| Use Case                           | Choice            | Why                                       |
| ---------------------------------- | ----------------- | ----------------------------------------- |
| Reactive state (current + changes) | `SubscriptionRef` | Subscribers get current value immediately |
| Event stream (fire-and-forget)     | `PubSub`          | Multiple consumers, no "current" state    |

---

## `Stream.unwrap` for Conditional Streams

When stream creation itself can fail, use `Stream.unwrap` to lift an `Effect<Stream>` into a `Stream`:

```typescript
subscribe: (name) =>
  Stream.unwrap(
    Effect.gen(function* () {
      const internals = yield* getDaemonOrFail(name)
      return internals.stateRef.changes
    }),
  )
```

---

## `Atom.debounce` — Trailing Edge Debounce

```typescript
const debouncedAtom = Atom.debounce(sourceAtom, 200)
// or
const debouncedAtom = sourceAtom.pipe(Atom.debounce(200))
```

- Trailing edge (fires after `duration` ms of no changes)
- Auto-cleans up timeouts on disposal
- Replaces custom `debouncedSignal` utilities

---

## `AtomRuntime.atom((get) => Effect)` — Async Derived Atoms

```typescript
const appsAtom = AtomRuntime.atom((get) => {
  const search = get(debouncedSearchAtom) // Dependency tracking
  return listApps(search) // Returns Effect
})
// Type: Atom<Result.Result<Application[], Error>>
```

- `get(atom)` tracks dependencies — re-runs when dependencies change
- Has access to layer services (BunContext, DaemonManager, etc.)
- Returns `Result` wrapping success/failure/loading states

---

## `AtomRuntime.fn` — Callable Effect Atoms

```typescript
const launchAppAtom = AtomRuntime.fn((name: string) => launchApp(name))

// Usage with useAtomSet:
const launchAppFn = useAtomSet(launchAppAtom, { mode: "promiseExit" })
const exit = await launchAppFn("firefox")
if (Exit.isSuccess(exit)) {
  // ...
}
```

---

## `useAtomSet` Modes

| Mode                | Returns               | On Failure             |
| ------------------- | --------------------- | ---------------------- |
| `"value"` (default) | `void`                | Fire-and-forget        |
| `"promise"`         | `Promise<A>`          | Throws                 |
| `"promiseExit"`     | `Promise<Exit<A, E>>` | Returns `Exit.Failure` |

---

## `Result.getOrElse` — Extract with Fallback

```typescript
const apps = pipe(
  appsResult(),
  Result.getOrElse(() => [] as Application[]),
)
```

Returns value if Success, fallback for Initial/Failure. Also returns `previousSuccess` value if available during refetch.

---

## `Effect.provide(ManagedRuntime)` — Reuse Built Layers

`Effect.provide()` accepts a `ManagedRuntime` directly, not just layers or contexts. This lets you reuse the already-built runtime without rebuilding layers.

```typescript
const AppLayer = Layer.merge(DaemonManager.Default, BunContext.layer)
const AppRuntime = ManagedRuntime.make(AppLayer, Atom.runtime.memoMap)

// Use BunRuntime.runMain for signal handling, provide AppRuntime for services
BunRuntime.runMain(
  Effect.gen(function* () {
    const dm = yield* DaemonManager
    yield* dm.set({ name: "status-bar", command: ["kitten", "panel", "bar"] })

    render(() => <App />, { exitOnCtrlC: false })
  }).pipe(Effect.provide(AppRuntime)),
)
```

### What Happens Internally

When you `Effect.provide(managedRuntime)`:

1. Effect calls `managedRuntime.runtimeEffect` to get the **cached `Runtime<R>`**
2. That runtime was built once using the layer + memoMap
3. The runtime's **Context** (containing built services) is provided to your effect
4. **No layer rebuilding** — just context injection

```typescript
// Simplified internal flow:
function provide(managed, effect) {
  return flatMap(
    managed.runtimeEffect, // Gets cached Runtime<R>
    (rt) => provideContext(effect, rt.context), // Injects built services
  )
}
```

### Why This Matters

- **Same service instances**: If `AppRuntime` and `AtomRuntime` share a `memoMap`, they share service instances
- **No `toRuntimeWithMemoMap` gymnastics**: Just pass the runtime directly
- **Works with `BunRuntime.runMain`**: Get signal handling + teardown while using your managed services

---

## opentui + Effect: Clean Exit Pattern

### The Problem

When using opentui with Effect's `ManagedRuntime`, you need to:

1. **Clean up the terminal** — exit alt buffer, restore raw mode, show cursor
2. **Dispose Effect runtime** — run finalizers, kill daemon processes
3. **Exit the process** — but only after cleanup completes

Getting this wrong leaves your terminal in a broken state (stuck in alt buffer, no echo, hidden cursor). Run `reset` to fix.

### Raw Mode Context

opentui puts the terminal in **raw mode** (`stdin.setRawMode(true)`), which means:

- **Ctrl+C doesn't generate SIGINT** — it's sent as bytes (`0x03`) to stdin
- **No echo** — characters you type aren't displayed
- **Alternate screen buffer** — separate screen from your shell

This is why `BunRuntime.runMain`'s signal handlers won't catch Ctrl+C — it never becomes a signal. opentui must handle it as keyboard input.

### The Wrong Ways

**Wrong #1: Manual Ctrl+C handler with `process.exit()`**

```typescript
useKeyboard((event) => {
  if (event.ctrl && event.name === "c") {
    AppRuntime.dispose().finally(() => process.exit(0)) // ❌ Terminal not cleaned!
  }
})
```

Problem: `process.exit()` runs before opentui can restore terminal state.

**Wrong #2: Using `BunRuntime.runMain` with `render()` inside**

```typescript
BunRuntime.runMain(
  Effect.gen(function* () {
    void render(() => <App />, { exitOnCtrlC: true })
  }).pipe(Effect.provide(AppRuntime))
)
```

Problem: `BunRuntime.runMain` keeps process alive with `setInterval`. Its SIGINT handler never fires because opentui is in raw mode (Ctrl+C becomes keyboard input, not signal). You end up with competing handlers and broken cleanup.

### The Clean Solution

Let opentui handle Ctrl+C entirely, hook into `onDestroy` for Effect cleanup:

```typescript
// 1. Run Effect setup with runFork (fire and forget, no process keep-alive)
AppRuntime.runFork(
  Effect.gen(function* () {
    const dm = yield* DaemonManager
    yield* dm.set({ name: "my-daemon", command: ["..."] })
  })
)

// 2. render() at top level, let opentui own the process lifecycle
await render(
  () => <App />,
  {
    exitOnCtrlC: true,  // opentui handles Ctrl+C, calls destroy()
    onDestroy: () => {
      void AppRuntime.dispose()  // Clean up Effect runtime
    },
    // ...other options
  } satisfies CliRendererConfig
)
```

### Why This Works

1. **Ctrl+C pressed** → opentui's keypress handler catches it (raw mode = keyboard input)
2. **`destroy()` called** → opentui cleans up terminal:
   - `stdin.setRawMode(false)` — restore terminal mode
   - Exit alternate screen buffer
   - Show cursor
   - Remove all listeners
3. **`onDestroy` callback fires** → `AppRuntime.dispose()` runs finalizers (kills daemon processes)
4. **Process exits naturally** — nothing keeping it alive (no `setInterval`, no pending I/O)

### Key Insights

- **`exitOnCtrlC: true`** doesn't call `process.exit()` — it just calls `renderer.destroy()`
- **Terminal cleanup happens BEFORE `onDestroy`** — your callback runs after terminal is restored
- **No explicit `process.exit()` needed** — without `BunRuntime.runMain`'s keep-alive interval, process exits when event loop is empty
- **`void AppRuntime.dispose()`** — fire and forget is fine; process waits for dispose to complete naturally

### Comparison

| Approach                             | Terminal Cleanup   | Effect Cleanup | Complexity |
| ------------------------------------ | ------------------ | -------------- | ---------- |
| Manual `process.exit()`              | ❌ Broken          | ✅ Works       | High       |
| `BunRuntime.runMain` + render inside | ❌ Race conditions | ⚠️ Complicated | Very High  |
| `exitOnCtrlC` + `onDestroy`          | ✅ Works           | ✅ Works       | **Low**    |

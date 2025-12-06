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

### Testing Proof

```
| Fork Method    | Process Survived dispose()? |
|----------------|----------------------------|
| forkDaemon     | ✅ YES — ORPHANED          |
| forkIn(e, scope) | ❌ NO — Properly killed   |
```

### Key Insight

The child process cleanup happens in `Command.start`'s `acquireRelease` finalizer. That finalizer ONLY runs when:

1. The fiber is interrupted, AND
2. The `Effect.scoped` wrapper's scope closes

With `forkDaemon`, the fiber is never interrupted by `dispose()`, so the finalizer never runs.

---

## `@opentui/core` Signal Handling

`@opentui/core` registers signal handlers via the `Renderer` class (see [renderer.ts](https://github.com/sst/opentui/blob/main/packages/core/src/renderer.ts) — `exitSignals` config and `addExitListeners` method):

```javascript
;["SIGINT", "SIGTERM", "SIGQUIT", "SIGABRT"].forEach((signal) => {
  process.on(signal, () => {
    process.exit() // Immediate exit, no cleanup!
  })
})
```

**Impact:** If a signal arrives, `process.exit()` is called immediately, bypassing any async cleanup like `runtime.dispose()`.

**Solution:** Use `exitOnCtrlC: false` and handle Ctrl+C manually:

```typescript
render(() => <App />, { exitOnCtrlC: false })

useKeyboard((event) => {
  if (event.ctrl && event.name === "c") {
    // Properly dispose before exiting
    AppRuntime.dispose().finally(() => process.exit(0))
  }
})
```

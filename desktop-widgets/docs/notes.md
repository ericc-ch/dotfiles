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

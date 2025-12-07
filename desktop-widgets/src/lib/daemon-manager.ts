import { Command } from "@effect/platform"
import type { PlatformError } from "@effect/platform/Error"
import {
  Data,
  Effect,
  Fiber,
  MutableHashMap,
  Option,
  pipe,
  Stream,
  SubscriptionRef,
} from "effect"

type DaemonState = "running" | "stopped"

export interface Daemon {
  name: string
  command: [string, ...string[]]
  state: SubscriptionRef.SubscriptionRef<DaemonState>
  fiber?: Fiber.RuntimeFiber<never, DaemonDiedError | PlatformError>
}

class DaemonNotFoundError extends Data.TaggedError("DaemonNotFoundError")<{
  readonly daemonName: string
}> {}

class DaemonDiedError extends Data.TaggedError("DaemonDiedError")<{
  readonly daemon: Daemon
  readonly exitCode: number
  readonly message: string
}> {}

export class DaemonManager extends Effect.Service<DaemonManager>()(
  "DaemonManager",
  {
    scoped: Effect.gen(function* () {
      const daemons = MutableHashMap.empty<string, Daemon>()
      const scope = yield* Effect.scope

      const set = Effect.fn(function* (
        daemon: Omit<Daemon, "state" | "fiber">,
      ) {
        const existing = MutableHashMap.get(daemons, daemon.name)

        if (Option.isNone(existing)) {
          const state = yield* SubscriptionRef.make<DaemonState>("stopped")

          return MutableHashMap.set(daemons, daemon.name, {
            ...daemon,
            state,
          })
        }

        return MutableHashMap.set(daemons, daemon.name, {
          ...daemon,
          state: existing.value.state,
        })
      })

      const start = Effect.fn(function* (name: string) {
        const daemon = MutableHashMap.get(daemons, name)

        if (Option.isNone(daemon)) {
          return yield* new DaemonNotFoundError({ daemonName: name })
        }

        const state = yield* SubscriptionRef.get(daemon.value.state)
        if (state === "running") {
          return
        }

        const spawnDaemon = Effect.gen(function* () {
          const process = yield* pipe(
            Command.make(...daemon.value.command),
            Command.start,
          )

          const exitCode = yield* process.exitCode
          const message = yield* pipe(
            process.stderr,
            Stream.decodeText(),
            Stream.runFold("", (acc, chunk) => acc + chunk),
          )

          return yield* new DaemonDiedError({
            daemon: daemon.value,
            exitCode,
            message,
          })
        }).pipe(Effect.scoped)

        const fiber = yield* pipe(spawnDaemon, Effect.forkIn(scope))
        yield* SubscriptionRef.set(daemon.value.state, "running")

        MutableHashMap.set(daemons, name, {
          ...daemon.value,
          fiber,
        })
      })

      const stop = Effect.fn(function* (name: string) {
        const daemon = MutableHashMap.get(daemons, name)

        if (Option.isNone(daemon)) {
          return yield* new DaemonNotFoundError({ daemonName: name })
        }

        if (daemon.value.fiber) {
          yield* Fiber.interrupt(daemon.value.fiber)
          yield* SubscriptionRef.set(daemon.value.state, "stopped")
        }
      })

      const list = Effect.fn(function* () {
        return MutableHashMap.values(daemons)
      })

      return {
        set,
        start,
        stop,
        list,
      }
    }),
  },
) {}

import { BunContext } from "@effect/platform-bun"
import { describe, expect, test } from "bun:test"
import { Effect, Exit, Fiber, Layer, SubscriptionRef } from "effect"
import { DaemonManager } from "./daemon-manager"

const TestLayer = Layer.merge(DaemonManager.Default, BunContext.layer)

const runTest = <A, E>(
  effect: Effect.Effect<
    A,
    E,
    DaemonManager | Layer.Layer.Success<typeof TestLayer>
  >,
) => Effect.runPromise(Effect.scoped(effect.pipe(Effect.provide(TestLayer))))

describe("DaemonManager", () => {
  describe("set", () => {
    test("registers a new daemon with stopped state", async () => {
      await runTest(
        Effect.gen(function* () {
          const manager = yield* DaemonManager

          yield* manager.set({ name: "test-daemon", command: ["sleep", "10"] })

          const daemons = yield* manager.list()
          const daemon = [...daemons].find((d) => d.name === "test-daemon")

          expect(daemon).toBeDefined()
          expect(daemon!.name).toBe("test-daemon")
          expect(daemon!.command).toEqual(["sleep", "10"])

          const state = yield* SubscriptionRef.get(daemon!.state)
          expect(state).toBe("stopped")
        }),
      )
    })

    test("updates existing daemon but preserves state", async () => {
      await runTest(
        Effect.gen(function* () {
          const manager = yield* DaemonManager

          yield* manager.set({ name: "test-daemon", command: ["sleep", "10"] })
          yield* manager.start("test-daemon")

          const daemonsBefore = yield* manager.list()
          const daemonBefore = [...daemonsBefore].find(
            (d) => d.name === "test-daemon",
          )
          const stateBefore = yield* SubscriptionRef.get(daemonBefore!.state)
          expect(stateBefore).toBe("running")

          yield* manager.set({ name: "test-daemon", command: ["sleep", "20"] })

          const daemonsAfter = yield* manager.list()
          const daemonAfter = [...daemonsAfter].find(
            (d) => d.name === "test-daemon",
          )

          expect(daemonAfter!.command).toEqual(["sleep", "20"])

          const stateAfter = yield* SubscriptionRef.get(daemonAfter!.state)
          expect(stateAfter).toBe("running")

          yield* manager.stop("test-daemon")
        }),
      )
    })
  })

  describe("start", () => {
    test("returns DaemonNotFoundError for unknown daemon", async () => {
      const result = await Effect.runPromise(
        Effect.scoped(
          Effect.gen(function* () {
            const manager = yield* DaemonManager
            const exit = yield* Effect.exit(manager.start("unknown-daemon"))
            return exit
          }).pipe(Effect.provide(TestLayer)),
        ),
      )

      expect(Exit.isFailure(result)).toBe(true)
      if (Exit.isFailure(result)) {
        const error = result.cause
        expect(String(error)).toContain("DaemonNotFoundError")
      }
    })

    test("starts a registered daemon and sets state to running", async () => {
      await runTest(
        Effect.gen(function* () {
          const manager = yield* DaemonManager

          yield* manager.set({ name: "test-daemon", command: ["sleep", "10"] })
          yield* manager.start("test-daemon")

          const daemons = yield* manager.list()
          const daemon = [...daemons].find((d) => d.name === "test-daemon")

          const state = yield* SubscriptionRef.get(daemon!.state)
          expect(state).toBe("running")
          expect(daemon!.fiber).toBeDefined()

          yield* manager.stop("test-daemon")
        }),
      )
    })

    test("does nothing when daemon already running", async () => {
      await runTest(
        Effect.gen(function* () {
          const manager = yield* DaemonManager

          yield* manager.set({ name: "test-daemon", command: ["sleep", "10"] })
          yield* manager.start("test-daemon")

          const daemonsBefore = yield* manager.list()
          const daemonBefore = [...daemonsBefore].find(
            (d) => d.name === "test-daemon",
          )
          const fiberBefore = daemonBefore!.fiber

          yield* manager.start("test-daemon")

          const daemonsAfter = yield* manager.list()
          const daemonAfter = [...daemonsAfter].find(
            (d) => d.name === "test-daemon",
          )
          const fiberAfter = daemonAfter!.fiber

          expect(fiberBefore).toBe(fiberAfter)

          yield* manager.stop("test-daemon")
        }),
      )
    })
  })

  describe("stop", () => {
    test("returns DaemonNotFoundError for unknown daemon", async () => {
      const result = await Effect.runPromise(
        Effect.scoped(
          Effect.gen(function* () {
            const manager = yield* DaemonManager
            const exit = yield* Effect.exit(manager.stop("unknown-daemon"))
            return exit
          }).pipe(Effect.provide(TestLayer)),
        ),
      )

      expect(Exit.isFailure(result)).toBe(true)
      if (Exit.isFailure(result)) {
        const error = result.cause
        expect(String(error)).toContain("DaemonNotFoundError")
      }
    })

    test("stops a running daemon and sets state to stopped", async () => {
      await runTest(
        Effect.gen(function* () {
          const manager = yield* DaemonManager

          yield* manager.set({ name: "test-daemon", command: ["sleep", "10"] })
          yield* manager.start("test-daemon")

          const daemonsBefore = yield* manager.list()
          const daemonBefore = [...daemonsBefore].find(
            (d) => d.name === "test-daemon",
          )
          const stateBefore = yield* SubscriptionRef.get(daemonBefore!.state)
          expect(stateBefore).toBe("running")

          yield* manager.stop("test-daemon")

          const daemonsAfter = yield* manager.list()
          const daemonAfter = [...daemonsAfter].find(
            (d) => d.name === "test-daemon",
          )
          const stateAfter = yield* SubscriptionRef.get(daemonAfter!.state)
          expect(stateAfter).toBe("stopped")
        }),
      )
    })
  })

  describe("list", () => {
    test("returns empty for fresh manager", async () => {
      await runTest(
        Effect.gen(function* () {
          const manager = yield* DaemonManager

          const daemons = yield* manager.list()
          const daemonList = [...daemons]

          expect(daemonList).toEqual([])
        }),
      )
    })

    test("returns all registered daemons", async () => {
      await runTest(
        Effect.gen(function* () {
          const manager = yield* DaemonManager

          yield* manager.set({ name: "daemon-1", command: ["sleep", "10"] })
          yield* manager.set({ name: "daemon-2", command: ["sleep", "20"] })
          yield* manager.set({ name: "daemon-3", command: ["sleep", "30"] })

          const daemons = yield* manager.list()
          const daemonList = [...daemons]

          expect(daemonList.length).toBe(3)

          const names = daemonList.map((d) => d.name).sort()
          expect(names).toEqual(["daemon-1", "daemon-2", "daemon-3"])
        }),
      )
    })
  })

  describe("DaemonDiedError", () => {
    test("fiber fails with DaemonDiedError when process exits", async () => {
      await runTest(
        Effect.gen(function* () {
          const manager = yield* DaemonManager

          yield* manager.set({ name: "dying-daemon", command: ["false"] })
          yield* manager.start("dying-daemon")

          const daemons = yield* manager.list()
          const daemon = [...daemons].find((d) => d.name === "dying-daemon")

          expect(daemon!.fiber).toBeDefined()

          const exit = yield* Fiber.await(daemon!.fiber!)

          expect(Exit.isFailure(exit)).toBe(true)
          if (Exit.isFailure(exit)) {
            const error = String(exit.cause)
            expect(error).toContain("DaemonDiedError")
          }
        }),
      )
    })
  })
})

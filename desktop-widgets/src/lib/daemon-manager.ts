import { Effect, MutableHashMap, Schedule, SubscriptionRef } from "effect"

interface Daemon {
  name: string
  command: [string, ...string[]]
  state: "running" | "stopped"
}

export class DaemonManager extends Effect.Service<DaemonManager>()(
  "DaemonManager",
  {
    effect: Effect.gen(function* () {
      const daemons = MutableHashMap.empty<string, Daemon>()

      const runDaemon = Effect.fn

      return {
        register: (config: DaemonConfig) => {},
      }
    }),
  },
) {}

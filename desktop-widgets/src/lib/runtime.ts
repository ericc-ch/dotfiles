import { BunContext } from "@effect/platform-bun"
import { Effect, Layer, ManagedRuntime } from "effect"
import { Atom } from "./effect-solid"
import { DaemonManager } from "./daemon-manager"

const sharedMemoMap = Effect.runSync(Layer.makeMemoMap)

const AppLayer = Layer.merge(DaemonManager.Default, BunContext.layer)

export const AppRuntime = ManagedRuntime.make(AppLayer, sharedMemoMap)
export const AtomRuntime = Atom.context({ memoMap: sharedMemoMap })(AppLayer)

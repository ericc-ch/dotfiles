import { BunContext } from "@effect/platform-bun"
import { Layer, ManagedRuntime } from "effect"
import { Atom } from "./effect-solid"
import { DaemonManager } from "./daemon-manager"

const AppLayer = Layer.merge(DaemonManager.Default, BunContext.layer)

// Use Atom.runtime's memoMap so both systems share layer instances
export const AppRuntime = ManagedRuntime.make(AppLayer, Atom.runtime.memoMap)
export const AtomRuntime = Atom.runtime(AppLayer)

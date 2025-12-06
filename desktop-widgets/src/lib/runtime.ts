import { BunContext } from "@effect/platform-bun"
import { Layer, ManagedRuntime } from "effect"
import { DaemonManager } from "./daemon-manager"

const AppLayer = Layer.merge(DaemonManager.Default, BunContext.layer)

export const AppRuntime = ManagedRuntime.make(AppLayer)

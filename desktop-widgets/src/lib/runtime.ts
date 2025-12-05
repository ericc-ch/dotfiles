import { BunContext } from "@effect/platform-bun"
import { ManagedRuntime } from "effect"

export const AppRuntime = ManagedRuntime.make(BunContext.layer)

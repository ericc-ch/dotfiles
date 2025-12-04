import { BunContext } from "@effect/platform-bun"
import { ManagedRuntime } from "effect"

export const Runtime = ManagedRuntime.make(BunContext.layer)

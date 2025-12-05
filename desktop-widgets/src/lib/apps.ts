import { Command } from "@effect/platform"
import type { ExitCode } from "@effect/platform/CommandExecutor"
import { Data, Effect, pipe, Schema, Stream } from "effect"

export const Application = Schema.Struct({
  name: Schema.String,
  entry: Schema.String,
  executable: Schema.String,
  description: Schema.NullOr(Schema.String),
  icon_name: Schema.String,
  frequency: Schema.Number,
  keywords: Schema.Array(Schema.String),
  categories: Schema.Array(Schema.String),
})

export const Applications = Schema.Array(Application)
export const ApplicatonsFromString = Schema.parseJson(Applications)

export class CommandError extends Data.TaggedError("CommandError")<{
  readonly command: ReadonlyArray<string>
  readonly exitCode: ExitCode
  readonly stderr?: string
}> {}

export const listApps = (search?: string) => {
  const command =
    search ?
      Command.make("astal-apps", "--search", search, "--json")
    : Command.make("astal-apps", "--json")

  return command.pipe(
    Command.string,
    Effect.flatMap((output) =>
      Schema.decodeUnknown(ApplicatonsFromString)(output),
    ),
  )
}

export const launchApp = Effect.fn(function* (name: string) {
  const command = ["astal-apps", "--launch", name] as const

  const process = yield* Command.make(...command).pipe(Command.start)
  const exitCode = yield* process.exitCode

  if (exitCode !== 0) {
    const stderr = yield* pipe(
      process.stderr,
      Stream.decodeText(),
      Stream.runFold("", (acc, chunk) => acc + chunk),
    )

    return yield* new CommandError({ command, exitCode, stderr })
  }
}, Effect.scoped)

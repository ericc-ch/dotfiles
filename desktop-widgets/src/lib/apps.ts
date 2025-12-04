import { Command } from "@effect/platform"
import type { ExitCode } from "@effect/platform/CommandExecutor"
import { Data, Effect, pipe, Schema } from "effect"
import { decodeUnknown } from "effect/Schema"

const Application = Schema.Struct({
  name: Schema.String,
  entry: Schema.String,
  executable: Schema.String,
  description: Schema.NullOr(Schema.String),
  icon_name: Schema.String,
  frequency: Schema.Number,
  keywords: Schema.Array(Schema.String),
  categories: Schema.Array(Schema.String),
})

const Applications = Schema.Array(Application)
const ApplicatonsFromString = Schema.parseJson(Applications)

export class CommandError extends Data.TaggedError("CommandError")<{
  readonly command: ReadonlyArray<string>
  readonly exitCode: ExitCode
  readonly stderr?: string
}> {}

export const listApps = (search?: string) =>
  pipe(
    search ?
      Command.make("astal-apps", "--search", search, "--json")
    : Command.make("astal-apps", "--json"),
    Command.string,
    Effect.flatMap((output) => decodeUnknown(ApplicatonsFromString)(output)),
  )

export const launchApp = (name: string) => {
  const command = ["astal-apps", "--launch", name] as const

  return pipe(
    Command.make(...command),
    Command.start,
    Effect.flatMap(process => Effect.all([
      process.exitCode,
      process.stderr,
    ]))
    Effect.filterOrFail(
      ([code]) => code === 0,
      (code) =>
        new CommandError({
          command,
          exitCode: code,
        }),
    ),
  )
}

import { Command } from "@effect/platform"
import { Effect, pipe, Schema } from "effect"

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

const parseApplications = Schema.parseJson(Schema.Array(Application))

/**
 * Lists or searches for applications
 * @param searchTerm - Optional search term to filter applications (results are sorted by relevance when provided)
 * @returns Promise that resolves to an array of applications
 */
// export async function listApps(searchTerm?: string): Promise<Application[]> {
//   const args =
//     searchTerm ?
//       ["astal-apps", "--search", searchTerm, "--json"]
//     : ["astal-apps", "--json"]

//   const proc = Bun.spawn(args, {
//     stderr: "pipe",
//   })

//   const output = await proc.stdout.text()
//   const exitCode = await proc.exited

//   if (exitCode !== 0) {
//     const errorOutput = await proc.stderr.text()
//     throw new Error(
//       `astal-apps command failed with exit code ${exitCode}: ${errorOutput}`,
//     )
//   }

//   return JSON.parse(output) as Application[]
// }

export const listApps = Effect.fn(function* (search?: string) {
  return pipe(
    search ?
      Command.make("astal-apps", "--search", search, "--json")
    : Command.make("astal-apps", "--json"),
    Command.string,
    Effect.map((output) => Schema.json),
  )
})

// const parseApps = Schema.parsej

/**
 * Launches an application by its name
 * @param name - The display name of the application (e.g., "Ghostty", "Passwords and Keys")
 * @returns Promise that resolves when the application is launched
 */
export async function launchApp(name: string): Promise<void> {
  const proc = Bun.spawn(["astal-apps", "--launch", name], {
    stderr: "pipe",
  })

  const exitCode = await proc.exited

  if (exitCode !== 0) {
    const errorOutput = await proc.stderr.text()
    throw new Error(
      `astal-apps command failed with exit code ${exitCode}: ${errorOutput}`,
    )
  }
}

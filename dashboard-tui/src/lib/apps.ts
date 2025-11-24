export interface Application {
  name: string
  entry: string
  executable: string
  description: string | null
  icon_name: string
  frequency: number
  keywords: string[]
  categories: string[]
}

/**
 * Lists or searches for applications
 * @param searchTerm - Optional search term to filter applications (results are sorted by relevance when provided)
 * @returns Promise that resolves to an array of applications
 */
export async function listApps(searchTerm?: string): Promise<Application[]> {
  const args =
    searchTerm ?
      ["astal-apps", "--search", searchTerm, "--json"]
    : ["astal-apps", "--json"]

  const proc = Bun.spawn(args, {
    stderr: "pipe",
  })

  const output = await proc.stdout.text()
  const exitCode = await proc.exited

  if (exitCode !== 0) {
    const errorOutput = await proc.stderr.text()
    throw new Error(
      `astal-apps command failed with exit code ${exitCode}: ${errorOutput}`,
    )
  }

  return JSON.parse(output) as Application[]
}

/**
 * Launches an application by its entry name (desktop file name)
 * @param entryName - The entry name of the application to launch (e.g., "kitty.desktop")
 * @returns Promise that resolves when the application is launched
 */
export async function launchApp(entryName: string): Promise<void> {
  const proc = Bun.spawn(["astal-apps", "--launch", entryName], {
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

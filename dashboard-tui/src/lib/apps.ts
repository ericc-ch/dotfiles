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
 * Lists all available applications
 * @returns Promise that resolves to an array of applications
 */
export async function listApps(): Promise<Application[]> {
  const proc = Bun.spawn(["astal-apps", "--json"], {
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
 * Searches for applications by a search term (results are sorted by relevance)
 * @param searchTerm - The term to search for
 * @returns Promise that resolves to an array of matching applications
 */
export async function searchApps(searchTerm: string): Promise<Application[]> {
  const proc = Bun.spawn(["astal-apps", "--search", searchTerm, "--json"], {
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

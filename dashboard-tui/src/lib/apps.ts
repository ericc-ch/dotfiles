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
 * Extracts basename from desktop entry name for app launching
 * @param entryName - The entry name (e.g., "com.mitchellh.ghostty.desktop")
 * @returns The basename (e.g., "ghostty")
 * @see Converts reverse-DNS names to simple names to avoid astal-apps segfaults
 */
export function extractAppBasename(entryName: string): string {
  return (
    entryName
      .replace(/\.desktop$/, "")
      .split(".")
      .pop() ?? ""
  )
}

/**
 * Launches an application by its entry name (desktop file name)
 * @param entryName - The entry name of the application to launch (e.g., "kitty.desktop")
 * @returns Promise that resolves when the application is launched
 * @see Uses basename of entry (e.g., "com.mitchellh.ghostty.desktop" → "ghostty") to avoid astal-apps segfaults with reverse-DNS names
 */
export async function launchApp(entryName: string): Promise<void> {
  const basename = extractAppBasename(entryName)

  const proc = Bun.spawn(["astal-apps", "--launch", basename], {
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

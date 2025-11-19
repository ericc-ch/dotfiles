/**
 * PulseAudio control utility using pactl
 */

export interface AudioDevice {
  index: number
  name: string
  description: string
  type: "sink" | "source"
  state?: string | undefined
  mute?: boolean | undefined
  volume?:
    | Record<string, { value: number; value_percent: string; db: string }>
    | undefined
}

interface PactlDevice {
  index: number
  name: string
  description: string
  state?: string
  mute?: boolean
  volume?: Record<string, { value: number; value_percent: string; db: string }>
}

/**
 * Lists all audio output devices (sinks) using pactl with JSON output
 * @returns Promise that resolves to an array of sink devices
 */
export async function listSinks(): Promise<AudioDevice[]> {
  const sinksProc = Bun.spawn(["pactl", "--format=json", "list", "sinks"], {
    stdout: "pipe",
    stderr: "pipe",
  })

  const sinksOutput = await new Response(sinksProc.stdout).text()
  const sinksExitCode = await sinksProc.exited

  if (sinksExitCode !== 0) {
    const errorOutput = await new Response(sinksProc.stderr).text()
    throw new Error(
      `pactl command failed with exit code ${sinksExitCode}: ${errorOutput}`,
    )
  }

  // Parse JSON sinks
  const sinks = JSON.parse(sinksOutput) as PactlDevice[]
  return sinks.map((sink) => ({
    index: sink.index,
    name: sink.name,
    description: sink.description,
    type: "sink" as const,
    state: sink.state,
    mute: sink.mute,
    volume: sink.volume,
  }))
}

/**
 * Lists all audio input devices (sources) using pactl with JSON output
 * @returns Promise that resolves to an array of source devices
 */
export async function listSources(): Promise<AudioDevice[]> {
  const sourcesProc = Bun.spawn(["pactl", "--format=json", "list", "sources"], {
    stdout: "pipe",
    stderr: "pipe",
  })

  const sourcesOutput = await new Response(sourcesProc.stdout).text()
  const sourcesExitCode = await sourcesProc.exited

  if (sourcesExitCode !== 0) {
    const errorOutput = await new Response(sourcesProc.stderr).text()
    throw new Error(
      `pactl command failed with exit code ${sourcesExitCode}: ${errorOutput}`,
    )
  }

  // Parse JSON sources
  const sources = JSON.parse(sourcesOutput) as PactlDevice[]
  return sources.map((source) => ({
    index: source.index,
    name: source.name,
    description: source.description,
    type: "source" as const,
    state: source.state,
    mute: source.mute,
    volume: source.volume,
  }))
}

/**
 * Lists all audio devices (sinks and sources) using pactl with JSON output
 * @returns Promise that resolves to an array of audio devices
 */
export async function listAudioDevices(): Promise<AudioDevice[]> {
  const [sinks, sources] = await Promise.all([listSinks(), listSources()])
  return [...sinks, ...sources]
}

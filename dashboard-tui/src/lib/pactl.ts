/**
 * PulseAudio control utility using pactl
 */

/**
 * Device state as defined by PulseAudio
 * @see https://github.com/pulseaudio/pulseaudio/blob/master/src/pulse/def.h
 */
export type DeviceState = "RUNNING" | "IDLE" | "SUSPENDED" | "INVALID_STATE"

export interface AudioDevice {
  index: number
  name: string
  description: string
  type: "sink" | "source"
  state?: DeviceState | undefined
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
    stderr: "pipe",
  })

  const sinksOutput = await sinksProc.stdout.text()
  const sinksExitCode = await sinksProc.exited

  if (sinksExitCode !== 0) {
    const errorOutput = await sinksProc.stderr.text()
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
    state: sink.state as DeviceState | undefined,
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
    stderr: "pipe",
  })

  const sourcesOutput = await sourcesProc.stdout.text()
  const sourcesExitCode = await sourcesProc.exited

  if (sourcesExitCode !== 0) {
    const errorOutput = await sourcesProc.stderr.text()
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
    state: source.state as DeviceState | undefined,
    mute: source.mute,
    volume: source.volume,
  }))
}

/**
 * Gets the default audio output device (sink) name
 * @returns Promise that resolves to the name of the default sink
 */
export async function getDefaultSink(): Promise<string> {
  const proc = Bun.spawn(["pactl", "get-default-sink"], {
    stderr: "pipe",
  })

  const output = await proc.stdout.text()
  const exitCode = await proc.exited

  if (exitCode !== 0) {
    const errorOutput = await proc.stderr.text()
    throw new Error(
      `pactl command failed with exit code ${exitCode}: ${errorOutput}`,
    )
  }

  return output.trim()
}

/**
 * Sets the default audio output device (sink)
 * @param deviceName - The name of the sink to set as default
 * @returns Promise that resolves when the default sink is set
 */
export async function setDefaultSink(deviceName: string): Promise<void> {
  const proc = Bun.spawn(["pactl", "set-default-sink", deviceName], {
    stderr: "pipe",
  })

  const exitCode = await proc.exited

  if (exitCode !== 0) {
    const errorOutput = await proc.stderr.text()
    throw new Error(
      `pactl command failed with exit code ${exitCode}: ${errorOutput}`,
    )
  }
}

/**
 * Sets the default audio input device (source)
 * @param deviceName - The name of the source to set as default
 * @returns Promise that resolves when the default source is set
 */
export async function setDefaultSource(deviceName: string): Promise<void> {
  const proc = Bun.spawn(["pactl", "set-default-source", deviceName], {
    stderr: "pipe",
  })

  const exitCode = await proc.exited

  if (exitCode !== 0) {
    const errorOutput = await proc.stderr.text()
    throw new Error(
      `pactl command failed with exit code ${exitCode}: ${errorOutput}`,
    )
  }
}

/**
 * Gets the default audio input device (source) name
 * @returns Promise that resolves to the name of the default source
 */
export async function getDefaultSource(): Promise<string> {
  const proc = Bun.spawn(["pactl", "get-default-source"], {
    stderr: "pipe",
  })

  const output = await proc.stdout.text()
  const exitCode = await proc.exited

  if (exitCode !== 0) {
    const errorOutput = await proc.stderr.text()
    throw new Error(
      `pactl command failed with exit code ${exitCode}: ${errorOutput}`,
    )
  }

  return output.trim()
}

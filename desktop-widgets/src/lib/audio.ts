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

interface PactlVolumeResponse {
  volume: Record<string, { value: number; value_percent: string; db: string }>
  balance: number
}

interface PactlMuteResponse {
  mute: boolean
}

/**
 * Gets the volume and mute status of the default audio output device (sink)
 * @returns Promise that resolves to volume percentage (0-100) and muted status
 */
export async function getDefaultSinkVolume(): Promise<{
  volume: number
  muted: boolean
}> {
  const [volumeProc, muteProc] = [
    Bun.spawn(["pactl", "--format=json", "get-sink-volume", "@DEFAULT_SINK@"], {
      stderr: "pipe",
    }),
    Bun.spawn(["pactl", "--format=json", "get-sink-mute", "@DEFAULT_SINK@"], {
      stderr: "pipe",
    }),
  ]

  const [volumeOutput, muteOutput] = await Promise.all([
    volumeProc.stdout.text(),
    muteProc.stdout.text(),
  ])

  const [volumeExitCode, muteExitCode] = await Promise.all([
    volumeProc.exited,
    muteProc.exited,
  ])

  if (volumeExitCode !== 0) {
    const errorOutput = await volumeProc.stderr.text()
    throw new Error(
      `pactl get-sink-volume failed with exit code ${volumeExitCode}: ${errorOutput}`,
    )
  }

  if (muteExitCode !== 0) {
    const errorOutput = await muteProc.stderr.text()
    throw new Error(
      `pactl get-sink-mute failed with exit code ${muteExitCode}: ${errorOutput}`,
    )
  }

  const volumeData = JSON.parse(volumeOutput) as PactlVolumeResponse
  const muteData = JSON.parse(muteOutput) as PactlMuteResponse

  // Get volume from first channel
  const channels = Object.values(volumeData.volume)
  if (channels.length === 0) {
    throw new Error("No volume channels found in pactl response")
  }
  const volumePercent = parseInt(
    channels[0]!.value_percent.replace("%", ""),
    10,
  )

  return {
    volume: volumePercent,
    muted: muteData.mute,
  }
}

// -----------------------------------------------------------------------------
// Audio Monitor
// -----------------------------------------------------------------------------

/**
 * Event action from pactl subscribe
 */
export type AudioEventAction = "change" | "new" | "remove"

/**
 * Event object type from pactl subscribe
 */
export type AudioEventObject =
  | "sink"
  | "source"
  | "server"
  | "client"
  | "card"
  | "sink-input"
  | "source-output"
  | "module"

/**
 * Parsed event from pactl subscribe
 */
export interface AudioEvent {
  /** Event action type */
  action: AudioEventAction
  /** Object type that changed */
  object: AudioEventObject
  /** Object index */
  index: number
}

/**
 * Parses a line from pactl subscribe output
 * @param line - Raw line from pactl subscribe
 * @returns Parsed event or null if line is not relevant
 * @see https://www.freedesktop.org/wiki/Software/PulseAudio/Documentation/User/CLI/
 */
export function parseSubscribeLine(line: string): AudioEvent | null {
  // Format: "Event 'change' on sink #56"
  const match = line.match(/^Event '(\w+)' on ([\w-]+) #(\d+)$/)
  if (!match) return null

  const [, action, object, index] = match
  if (!action || !object || !index) return null

  return {
    action: action as AudioEventAction,
    object: object as AudioEventObject,
    index: parseInt(index, 10),
  }
}

/**
 * Options for createAudioMonitor
 */
export interface AudioMonitorOptions {
  /** Called when default sink volume or mute status changes */
  onVolumeChange?: (status: { volume: number; muted: boolean }) => void
  /** Called when default sink changes */
  onDefaultSinkChange?: (sinkName: string) => void
  /** Called on error */
  onError?: (error: Error) => void
}

/**
 * Creates an audio monitor that watches for volume and sink changes
 * Uses pactl subscribe for real-time events
 * @param options - Monitor options with callbacks
 * @returns Stop function to cleanup the monitor
 * @see https://www.freedesktop.org/wiki/Software/PulseAudio/Documentation/User/CLI/
 */
export function createAudioMonitor(options: AudioMonitorOptions): () => void {
  let proc: ReturnType<typeof Bun.spawn> | null = null
  let stopped = false

  const startMonitor = () => {
    if (stopped) return

    proc = Bun.spawn(["pactl", "subscribe"], {
      stdout: "pipe",
      stderr: "ignore",
      onExit() {
        // Auto-restart if not explicitly stopped
        if (!stopped) {
          setTimeout(startMonitor, 1000)
        }
      },
    })

    if (!(proc.stdout instanceof ReadableStream)) {
      options.onError?.(new Error("Failed to capture pactl stdout"))
      return
    }

    const decoder = new TextDecoder()
    let buffer = ""
    const stdout = proc.stdout as ReadableStream<Uint8Array>

    const readLoop = async () => {
      try {
        for await (const chunk of stdout) {
          if (stopped) break

          buffer += decoder.decode(chunk, { stream: true })
          const lines = buffer.split("\n")
          buffer = lines.pop() ?? ""

          for (const line of lines) {
            const event = parseSubscribeLine(line)
            if (!event) continue

            if (event.action === "change") {
              if (event.object === "sink") {
                // Volume or mute changed on a sink
                try {
                  const status = await getDefaultSinkVolume()
                  options.onVolumeChange?.(status)
                } catch (err) {
                  options.onError?.(err as Error)
                }
              } else if (event.object === "server") {
                // Default sink/source may have changed
                try {
                  const sinkName = await getDefaultSink()
                  options.onDefaultSinkChange?.(sinkName)
                  // Also fetch new volume for the new default sink
                  const status = await getDefaultSinkVolume()
                  options.onVolumeChange?.(status)
                } catch (err) {
                  options.onError?.(err as Error)
                }
              }
            }
          }
        }
      } catch (err) {
        if (!stopped) {
          options.onError?.(err as Error)
        }
      }
    }

    readLoop()
  }

  // Initialize with current state
  const init = async () => {
    try {
      const status = await getDefaultSinkVolume()
      options.onVolumeChange?.(status)
    } catch (err) {
      options.onError?.(err as Error)
    }

    startMonitor()
  }

  init()

  // Return stop function
  return () => {
    stopped = true
    proc?.kill()
  }
}

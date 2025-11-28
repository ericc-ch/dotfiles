/**
 * Network connection type
 */
export type ConnectionType = "wifi" | "ethernet" | "other"

/**
 * Ethernet device state
 */
export type EthernetState = "connected" | "disconnected" | "unavailable"

/**
 * WiFi network information
 */
export interface WifiNetwork {
  /** Network SSID */
  ssid: string
  /** Access point MAC address */
  bssid: string
  /** Signal strength 0-100% */
  signal: number
  /** Connection rate (e.g., "130 Mbit/s") */
  rate?: string | undefined
  /** Frequency (e.g., "2427 MHz") */
  frequency?: string | undefined
  /** Channel number */
  channel?: number | undefined
  /** Security type (e.g., "WPA2") */
  security?: string | undefined
  /** Whether this network is currently connected */
  active: boolean
}

/**
 * Ethernet device information
 */
export interface EthernetDevice {
  /** Device name (e.g., "enp3s0", "eth0") */
  device: string
  /** Device state */
  state: EthernetState
  /** Connection name if connected */
  connection?: string | undefined
  /** Link speed in Mbit/s when connected */
  speed?: number | undefined
}

/**
 * Network connection status information
 */
export interface NetworkStatus {
  /** Network name (SSID for wifi, connection name for ethernet) */
  name: string
  /** Connection type */
  type: ConnectionType
  /** Network interface device (e.g., "wlan0", "eth0") */
  device: string
  /** Signal strength 0-100%, only available for wifi */
  signal?: number | undefined
  /** Connection rate (e.g., "130 Mbit/s") */
  rate?: string | undefined
  /** Frequency (e.g., "2427 MHz"), only available for wifi */
  frequency?: string | undefined
  /** Channel number, only available for wifi */
  channel?: number | undefined
  /** Security type (e.g., "WPA2"), only available for wifi */
  security?: string | undefined
}

// -----------------------------------------------------------------------------
// Monitor Event Types
// -----------------------------------------------------------------------------

/**
 * Event type from nmcli monitor
 */
export type MonitorEventType =
  | "connected"
  | "disconnected"
  | "connecting"
  | "connectivity"

/**
 * Connectivity state from nmcli monitor
 */
export type ConnectivityState = "full" | "limited" | "none"

/**
 * Event emitted by nmcli monitor
 */
export interface MonitorEvent {
  /** Event type */
  type: MonitorEventType
  /** Device name (e.g., "wlan0") */
  device?: string | undefined
  /** SSID when connecting to a network */
  ssid?: string | undefined
  /** Connectivity state */
  connectivity?: ConnectivityState | undefined
}

/**
 * Options for createNetworkMonitor
 */
export interface NetworkMonitorOptions {
  /** Called when network connects, with full connection info */
  onConnect?: (status: NetworkStatus) => void
  /** Called when network disconnects */
  onDisconnect?: () => void
  /** Called when signal strength changes (wifi only) */
  onSignalChange?: (signal: number) => void
  /** Called on error */
  onError?: (error: Error) => void
  /** Signal polling interval in ms (default: 1000) */
  signalPollInterval?: number
}

/**
 * Parses a line from nmcli monitor output
 * @param line - Raw line from nmcli monitor
 * @returns Parsed event or null if line is not relevant
 * @see https://networkmanager.dev/docs/api/latest/nmcli.html
 */
export function parseMonitorLine(line: string): MonitorEvent | null {
  // "wlan0: connected"
  const connectedMatch = line.match(/^(\w+): connected$/)
  if (connectedMatch) {
    return { type: "connected", device: connectedMatch[1] }
  }

  // "wlan0: disconnected"
  const disconnectedMatch = line.match(/^(\w+): disconnected$/)
  if (disconnectedMatch) {
    return { type: "disconnected", device: disconnectedMatch[1] }
  }

  // "wlan0: using connection 'Chili'"
  const usingMatch = line.match(/^(\w+): using connection '(.+)'$/)
  if (usingMatch) {
    return { type: "connecting", device: usingMatch[1], ssid: usingMatch[2] }
  }

  // "Connectivity is now 'full'"
  const connectivityMatch = line.match(/^Connectivity is now '(\w+)'$/)
  if (connectivityMatch) {
    return {
      type: "connectivity",
      connectivity: connectivityMatch[1] as ConnectivityState,
    }
  }

  return null
}

// -----------------------------------------------------------------------------
// WiFi Signal (fast path via /proc/net/wireless)
// -----------------------------------------------------------------------------

/**
 * Reads WiFi signal strength from /proc/net/wireless
 * Much faster than nmcli (~1ms vs ~11ms)
 * @param device - WiFi device name (default: "wlan0")
 * @returns Signal strength 0-100% or null if not available
 * @see https://www.kernel.org/doc/Documentation/ABI/testing/procfs-net-wireless
 */
export async function readWifiSignal(device = "wlan0"): Promise<number | null> {
  try {
    const file = Bun.file("/proc/net/wireless")
    const text = await file.text()

    // Format: " wlan0: 0000   32.  -78.  -256 ..."
    //                         ^^ link quality (0-70 scale)
    const regex = new RegExp(`^\\s*${device}:\\s+\\d+\\s+(\\d+)\\.`, "m")
    const match = text.match(regex)
    if (!match?.[1]) return null

    const linkQuality = parseInt(match[1], 10)
    // Convert 0-70 scale to 0-100 percentage
    return Math.round((linkQuality / 70) * 100)
  } catch {
    return null
  }
}

// -----------------------------------------------------------------------------
// WiFi
// -----------------------------------------------------------------------------
// WiFi
// -----------------------------------------------------------------------------

/**
 * Parses nmcli terse output for wifi network list
 * @param output - Raw nmcli output
 * @returns Array of WifiNetwork objects
 */
function parseWifiListOutput(output: string): WifiNetwork[] {
  // Format: SSID:BSSID:SIGNAL:RATE:FREQ:CHAN:SECURITY:DEVICE:ACTIVE
  // BSSID has escaped colons like 34\:78\:39\:45\:F9\:B0
  const lines = output.trim().split("\n")
  const networks: WifiNetwork[] = []

  for (const line of lines) {
    if (!line) continue

    // Split by unescaped colons (colons not preceded by backslash)
    const parts = line.split(/(?<!\\):/)
    if (parts.length < 9) continue

    const ssid = parts[0]
    const bssid = parts[1]?.replace(/\\:/g, ":") // Unescape colons in BSSID
    const signal = parts[2]
    const rate = parts[3]
    const freq = parts[4]
    const chan = parts[5]
    const security = parts[6]
    const active = parts[8]

    if (!ssid || !bssid) continue

    networks.push({
      ssid,
      bssid,
      signal: signal ? parseInt(signal, 10) : 0,
      rate: rate ?? undefined,
      frequency: freq ?? undefined,
      channel: chan ? parseInt(chan, 10) : undefined,
      security: security ?? undefined,
      active: active === "yes",
    })
  }

  return networks
}

/**
 * Lists all visible WiFi networks
 * @returns Promise that resolves to array of WifiNetwork objects
 * @see https://networkmanager.dev/docs/api/latest/nmcli.html
 */
export async function listWifiNetworks(): Promise<WifiNetwork[]> {
  const proc = Bun.spawn(
    [
      "nmcli",
      "-t",
      "-f",
      "SSID,BSSID,SIGNAL,RATE,FREQ,CHAN,SECURITY,DEVICE,ACTIVE",
      "dev",
      "wifi",
      "list",
    ],
    { stderr: "pipe" },
  )

  const output = await proc.stdout.text()
  const exitCode = await proc.exited

  if (exitCode !== 0) {
    const errorOutput = await proc.stderr.text()
    throw new Error(
      `nmcli command failed with exit code ${exitCode}: ${errorOutput}`,
    )
  }

  return parseWifiListOutput(output)
}

// -----------------------------------------------------------------------------
// Ethernet
// -----------------------------------------------------------------------------

/**
 * Reads ethernet link speed from sysfs
 * @param device - Device name (e.g., "enp3s0")
 * @returns Speed in Mbit/s or undefined if not available
 */
async function getEthernetSpeed(device: string): Promise<number | undefined> {
  try {
    const file = Bun.file(`/sys/class/net/${device}/speed`)
    const text = await file.text()
    const speed = parseInt(text.trim(), 10)
    // -1 means no link or unknown speed
    return speed > 0 ? speed : undefined
  } catch {
    return undefined
  }
}

/**
 * Lists all ethernet devices and their status
 * @returns Promise that resolves to array of EthernetDevice objects
 * @see https://networkmanager.dev/docs/api/latest/nmcli.html
 */
export async function listEthernetDevices(): Promise<EthernetDevice[]> {
  const proc = Bun.spawn(
    ["nmcli", "-t", "-f", "DEVICE,TYPE,STATE,CONNECTION", "dev", "status"],
    { stderr: "pipe" },
  )

  const output = await proc.stdout.text()
  const exitCode = await proc.exited

  if (exitCode !== 0) {
    const errorOutput = await proc.stderr.text()
    throw new Error(
      `nmcli command failed with exit code ${exitCode}: ${errorOutput}`,
    )
  }

  const lines = output.trim().split("\n")
  const devices: EthernetDevice[] = []

  for (const line of lines) {
    if (!line) continue

    const [device, type, state, connection] = line.split(":")
    if (type !== "ethernet" || !device) continue

    let ethState: EthernetState = "disconnected"
    if (state === "connected") ethState = "connected"
    else if (state === "unavailable") ethState = "unavailable"

    devices.push({
      device,
      state: ethState,
      connection: connection ?? undefined,
      speed: undefined, // Will be populated below
    })
  }

  // Fetch speeds in parallel
  await Promise.all(
    devices.map(async (dev) => {
      if (dev.state === "connected") {
        dev.speed = await getEthernetSpeed(dev.device)
      }
    }),
  )

  return devices
}

// -----------------------------------------------------------------------------
// Active Connection
// -----------------------------------------------------------------------------

/**
 * Parses nmcli terse output for wifi devices (active connection)
 * @param output - Raw nmcli output
 * @returns Parsed NetworkStatus or null if not connected
 */
function parseWifiOutput(output: string): NetworkStatus | null {
  // Format: SSID:SIGNAL:RATE:FREQ:CHAN:SECURITY:DEVICE:ACTIVE
  const lines = output.trim().split("\n")
  for (const line of lines) {
    if (!line.endsWith(":yes")) continue

    const parts = line.split(":")
    if (parts.length < 8) continue

    const ssid = parts[0]
    const signal = parts[1]
    const rate = parts[2]
    const freq = parts[3]
    const chan = parts[4]
    const security = parts[5]
    const device = parts[6]

    if (!ssid || !device) continue

    return {
      name: ssid,
      type: "wifi",
      device,
      signal: signal ? parseInt(signal, 10) : undefined,
      rate: rate ?? undefined,
      frequency: freq ?? undefined,
      channel: chan ? parseInt(chan, 10) : undefined,
      security: security ?? undefined,
    }
  }
  return null
}

/**
 * Parses nmcli terse output for active connections
 * @param output - Raw nmcli output
 * @returns Array of connection info [name, type, device]
 */
function parseConnectionOutput(
  output: string,
): Array<{ name: string; type: string; device: string }> {
  const lines = output.trim().split("\n")
  const connections: Array<{ name: string; type: string; device: string }> = []

  for (const line of lines) {
    if (!line) continue
    const [name, type, device] = line.split(":")
    if (name && type && device) {
      connections.push({ name, type, device })
    }
  }

  return connections
}

/**
 * Gets the currently active network connection
 * @returns Promise that resolves to NetworkStatus or null if no active connection
 * @see https://networkmanager.dev/docs/api/latest/nmcli.html
 */
export async function getActiveConnection(): Promise<NetworkStatus | null> {
  // First try to get wifi info (has more details)
  const wifiProc = Bun.spawn(
    [
      "nmcli",
      "-t",
      "-f",
      "SSID,SIGNAL,RATE,FREQ,CHAN,SECURITY,DEVICE,ACTIVE",
      "dev",
      "wifi",
    ],
    { stderr: "pipe" },
  )

  const wifiOutput = await wifiProc.stdout.text()
  const wifiExitCode = await wifiProc.exited

  // If wifi command succeeded, check for active wifi connection
  if (wifiExitCode === 0 && wifiOutput.trim()) {
    const wifiStatus = parseWifiOutput(wifiOutput)
    if (wifiStatus) return wifiStatus
  }

  // Fall back to checking active connections (for ethernet, etc.)
  const connProc = Bun.spawn(
    ["nmcli", "-t", "-f", "NAME,TYPE,DEVICE", "connection", "show", "--active"],
    { stderr: "pipe" },
  )

  const connOutput = await connProc.stdout.text()
  const connExitCode = await connProc.exited

  if (connExitCode !== 0) {
    const errorOutput = await connProc.stderr.text()
    throw new Error(
      `nmcli command failed with exit code ${connExitCode}: ${errorOutput}`,
    )
  }

  const connections = parseConnectionOutput(connOutput)

  // Find first non-loopback connection
  for (const conn of connections) {
    if (conn.type === "loopback") continue

    let type: ConnectionType = "other"
    if (conn.type === "802-11-wireless") type = "wifi"
    else if (conn.type === "802-3-ethernet") type = "ethernet"

    return {
      name: conn.name,
      type,
      device: conn.device,
    }
  }

  return null
}

// -----------------------------------------------------------------------------
// Network Monitor
// -----------------------------------------------------------------------------

/**
 * Creates a network monitor that watches for connection changes and signal updates
 * Uses nmcli monitor for connection events and /proc/net/wireless for signal polling
 * @param options - Monitor options with callbacks
 * @returns Stop function to cleanup the monitor
 * @see https://networkmanager.dev/docs/api/latest/nmcli.html
 */
export function createNetworkMonitor(
  options: NetworkMonitorOptions,
): () => void {
  let proc: ReturnType<typeof Bun.spawn> | null = null
  let signalInterval: ReturnType<typeof setInterval> | null = null
  let stopped = false
  let currentDevice: string | null = null

  const startMonitor = () => {
    if (stopped) return

    proc = Bun.spawn(["nmcli", "monitor"], {
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
      options.onError?.(new Error("Failed to capture nmcli stdout"))
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
            const event = parseMonitorLine(line)
            if (!event) continue

            if (event.type === "connected" && event.device) {
              currentDevice = event.device
              try {
                const status = await getActiveConnection()
                if (status) options.onConnect?.(status)
              } catch (err) {
                options.onError?.(err as Error)
              }
            } else if (event.type === "disconnected") {
              currentDevice = null
              options.onDisconnect?.()
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

  const startSignalPolling = () => {
    const interval = options.signalPollInterval ?? 1000

    signalInterval = setInterval(async () => {
      if (stopped || !currentDevice) return

      const signal = await readWifiSignal(currentDevice)
      if (signal !== null) {
        options.onSignalChange?.(signal)
      }
    }, interval)
  }

  // Initialize
  const init = async () => {
    try {
      const status = await getActiveConnection()
      if (status) {
        currentDevice = status.device
        options.onConnect?.(status)
      }
    } catch (err) {
      options.onError?.(err as Error)
    }

    startMonitor()
    startSignalPolling()
  }

  init()

  // Return stop function
  return () => {
    stopped = true
    proc?.kill()
    if (signalInterval) clearInterval(signalInterval)
  }
}

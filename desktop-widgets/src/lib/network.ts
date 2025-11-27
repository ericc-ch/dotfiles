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
      rate: rate || undefined,
      frequency: freq || undefined,
      channel: chan ? parseInt(chan, 10) : undefined,
      security: security || undefined,
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
      connection: connection || undefined,
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
      rate: rate || undefined,
      frequency: freq || undefined,
      channel: chan ? parseInt(chan, 10) : undefined,
      security: security || undefined,
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

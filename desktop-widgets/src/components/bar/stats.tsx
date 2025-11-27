import { createResource, onCleanup, onMount } from "solid-js"
import { getActiveConnection } from "../../lib/network"
import { useTheme } from "../../providers/theme"

const POLL_INTERVAL_MS = 5000
const SIGNAL_BARS = 5

/**
 * Converts signal strength (0-100) to visual bars
 * @param signal - Signal strength percentage
 * @returns String of filled and empty bars
 */
function signalToBars(signal: number): string {
  const filled = Math.round((signal / 100) * SIGNAL_BARS)
  return "▣".repeat(filled) + "▢".repeat(SIGNAL_BARS - filled)
}

export const Stats = () => {
  const theme = useTheme()

  const [network, { refetch }] = createResource(
    () => true,
    () => getActiveConnection(),
    { initialValue: null },
  )

  onMount(() => {
    const interval = setInterval(() => {
      refetch()
    }, POLL_INTERVAL_MS)

    onCleanup(() => {
      clearInterval(interval)
    })
  })

  const label = () => {
    const conn = network()
    if (!conn) return "No Net"
    if (conn.type === "ethernet") return "Eth"
    return conn.name // SSID for wifi
  }

  const bars = () => {
    const conn = network()
    if (!conn) return signalToBars(0)
    if (conn.type === "ethernet") return "" // No signal for ethernet
    return signalToBars(conn.signal ?? 0)
  }

  return (
    <text fg={theme().fg.normal}>
      {label()} {bars()}
    </text>
  )
}

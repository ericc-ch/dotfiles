import { createSignal, onCleanup, onMount } from "solid-js"

import { createNetworkMonitor, type NetworkStatus } from "../../lib/network"
import { useTheme } from "../../providers/theme"

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

  const [network, setNetwork] = createSignal<NetworkStatus | null>(null)
  const [signal, setSignal] = createSignal<number>(0)

  onMount(() => {
    const stop = createNetworkMonitor({
      onConnect: (status) => {
        setNetwork(status)
        if (status.signal !== undefined) {
          setSignal(status.signal)
        }
      },
      onDisconnect: () => {
        setNetwork(null)
        setSignal(0)
      },
      onSignalChange: (sig) => {
        setSignal(sig)
      },
      signalPollInterval: 10_000,
    })

    onCleanup(stop)
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
    return signalToBars(signal())
  }

  return (
    <text fg={theme().fg.normal}>
      {"  "}
      {label()} {bars()}
    </text>
  )
}

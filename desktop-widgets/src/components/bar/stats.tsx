import { createSignal, onCleanup, onMount } from "solid-js"

import { createAudioMonitor } from "../../lib/audio"
import { createNetworkMonitor, type NetworkStatus } from "../../lib/network"
import { useTheme } from "../../providers/theme"

const DEFAULT_BAR_COUNT = 5

/**
 * Converts a percentage value (0-100) to visual bars
 * @param value - Percentage value
 * @param barCount - Number of bars to display (default: 5)
 * @returns String of filled and empty bars
 */
function toBars(value: number, barCount: number = DEFAULT_BAR_COUNT): string {
  const filledCount = Math.round((Math.min(value, 100) / 100) * barCount)
  return "▣".repeat(filledCount) + "▢".repeat(barCount - filledCount)
}

export const Stats = () => {
  const theme = useTheme()

  const [network, setNetwork] = createSignal<NetworkStatus | null>(null)
  const [signal, setSignal] = createSignal(0)

  const [muted, setMuted] = createSignal(false)
  const [volume, setVolume] = createSignal(0)

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

  onMount(() => {
    const stop = createAudioMonitor({
      onVolumeChange: (status) => {
        setVolume(status.volume)
        setMuted(status.muted)
      },
    })

    onCleanup(stop)
  })

  const networkStats = () => {
    let label = "No Net"

    const conn = network()
    if (!conn) label = "No Net"
    else if (conn.type === "ethernet") label = "Eth"
    else label = conn.name // SSID for wifi

    let bars = ""
    if (!conn) bars = toBars(0)
    else if (conn.type === "ethernet")
      bars = "" // No signal for ethernet
    else bars = toBars(signal())

    return `󰖩 ${label} ${bars}`
  }

  const volumeStats = () => {
    const icon = muted() ? "󰝟" : "󰕾"
    const bars = toBars(volume())

    return (
      <box flexDirection="row" gap={1}>
        <text fg={theme().fg.normal}>{icon}</text>
        <text fg={muted() ? theme().fg.darker : theme().fg.normal}>
          {volume()}% {bars}
        </text>
      </box>
    )
  }

  return (
    <box flexDirection="row" gap={1}>
      <text fg={theme().fg.normal}>{networkStats()}</text>
      <text fg={theme().fg.normal}>/</text>
      {volumeStats()}
    </box>
  )
}

import { App, Astal, Gtk, Gdk } from "astal/gtk4"
import Hyprland from "gi://AstalHyprland"

const hyprland = Hyprland.get_default()

export function Bar(gdkmonitor: Gdk.Monitor) {
  const { TOP, LEFT, BOTTOM } = Astal.WindowAnchor
  const anchor = TOP | LEFT | BOTTOM

  return (
    <window
      visible
      anchor={anchor}
      application={App}
      cssClasses={["Bar"]}
      exclusivity={Astal.Exclusivity.EXCLUSIVE}
      gdkmonitor={gdkmonitor}
    >
      <box orientation={Gtk.Orientation.VERTICAL}>
        <button>wow</button>
        <button>wow</button>
        <button>wow</button>
        <button>wow</button>
        <BatteryWidget />
      </box>
    </window>
  )
}

import { bind } from "astal"
import Battery from "gi://AstalBattery"

function BatteryWidget() {
  const bat = Battery.get_default()

  const batteryIcon = bind(bat, "percentage").as((percentage) => {
    if (percentage > 0.9) return "󰁹" // Full
    if (percentage > 0.7) return "󰂀" // High
    if (percentage > 0.5) return "󰂁" // Medium
    if (percentage > 0.3) return "󰂂" // Low
    if (percentage > 0.1) return "󰁺" // Critical
    return "󰂃" // Empty
  })

  return (
    <box>
      <label label={batteryIcon} />
      <label label={bind(bat, "percentage").as((p) => p * 100 + "%")} />
    </box>
  )
}

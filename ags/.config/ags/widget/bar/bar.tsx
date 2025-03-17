import { App, Astal, Gdk, Gtk } from "astal/gtk4"

import { BatteryIndicator } from "./battery-indicator"
import { DateTime } from "./date-time"

const { TOP, LEFT, BOTTOM } = Astal.WindowAnchor
const anchor = TOP | LEFT | BOTTOM

export function Bar(monitor: Gdk.Monitor) {
  return (
    <window
      visible
      anchor={anchor}
      application={App}
      cssClasses={["bar"]}
      exclusivity={Astal.Exclusivity.EXCLUSIVE}
      gdkmonitor={monitor}
    >
      <box orientation={Gtk.Orientation.VERTICAL} spacing={16}>
        <DateTime />
        <BatteryIndicator />
      </box>
    </window>
  )
}

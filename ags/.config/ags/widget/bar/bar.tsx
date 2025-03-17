import { Variable } from "astal"
import { App, Astal, Gdk, Gtk } from "astal/gtk4"

import { isWeekend } from "../../lib/date"
import { BatteryIndicator } from "./battery-indicator"
import { DateTime } from "./date-time"

const { TOP, LEFT, BOTTOM } = Astal.WindowAnchor
const anchor = TOP | LEFT | BOTTOM

export function Bar(monitor: Gdk.Monitor) {
  const currentDate = Variable(new Date()).poll(1000, () => new Date())

  const classes = Variable.derive([currentDate], (date) => [
    "bar",
    isWeekend(date) ? "weekend" : "weekday",
  ])

  return (
    <window
      visible
      anchor={anchor}
      application={App}
      cssClasses={classes()}
      exclusivity={Astal.Exclusivity.EXCLUSIVE}
      gdkmonitor={monitor}
    >
      <centerbox orientation={Gtk.Orientation.VERTICAL}>
        <DateTime />
        <BatteryIndicator />
        <BatteryIndicator />
      </centerbox>
    </window>
  )
}

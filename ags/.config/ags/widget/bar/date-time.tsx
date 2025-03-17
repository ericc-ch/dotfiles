import { Variable } from "astal"
import { Gtk } from "astal/gtk4"

import { getDay, isWeekend } from "../../lib/date"

export function DateTime() {
  const time = Variable(new Date()).poll(1000, () => new Date())

  const dayClasses = Variable.derive([time], (time) => [
    "day",
    isWeekend(time) ? "weekend" : "weekday",
  ])

  return (
    <box cssClasses={["date-time"]} orientation={Gtk.Orientation.VERTICAL}>
      <label
        label={time((time) => `${time.getMonth() + 1}/${time.getDate()}`)}
      />
      <label cssClasses={dayClasses()} label={time((time) => getDay(time))} />
    </box>
  )
}

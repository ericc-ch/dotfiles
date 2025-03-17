import { Variable } from "astal"
import { Gtk } from "astal/gtk4"

import { formatTime, getDay, isWeekend } from "../../lib/date"

export function DateTime() {
  const currentDate = Variable(new Date()).poll(1000, () => new Date())

  const month = Variable.derive([currentDate], (date) =>
    (date.getMonth() + 1).toString(),
  )
  const date = Variable.derive([currentDate], (date) =>
    date.getDate().toString(),
  )

  const time = Variable.derive([currentDate], (date) => formatTime(date))

  const rootClasses = Variable.derive([currentDate], (date) => [
    "date-time",
    isWeekend(date) ? "weekend" : "weekday",
  ])

  const dayClasses = Variable.derive([currentDate], (date) => [
    "day",
    isWeekend(date) ? "weekend" : "weekday",
  ])

  return (
    <box cssClasses={rootClasses()} orientation={Gtk.Orientation.VERTICAL}>
      <box>
        <label cssClasses={["date"]} label={month()} />
        <label cssClasses={["date", "separator"]} label="/" />
        <label cssClasses={["date"]} label={date()} />
      </box>

      <label cssClasses={["time"]} halign={Gtk.Align.START} label={time()} />

      <label
        cssClasses={dayClasses()}
        halign={Gtk.Align.START}
        label={currentDate((time) => getDay(time))}
      />
    </box>
  )
}

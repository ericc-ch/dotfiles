import { Variable } from "astal"
import { Gtk } from "astal/gtk4"

import { getDay, isWeekend } from "../../lib/date"

export function DateTime() {
  const time = Variable(new Date()).poll(1000, () => new Date())
  const classes = Variable.derive([time], (time) => [
    "day",
    isWeekend(time) ? "weekend" : "weekday",
  ])
  const bgText = Variable.derive([time], (time) =>
    isWeekend(time) ? "WEEKEND" : "WEEKDAY",
  )

  return (
    <overlay cssClasses={["date-time"]}>
      <label
        cssClasses={["bg-text"]}
        label={bgText()}
        type="overlay clip"
      ></label>

      <box orientation={Gtk.Orientation.VERTICAL}>
        <label
          label={time((time) => `${time.getMonth() + 1}/${time.getDate()}`)}
        />
        <label cssClasses={classes()} label={time((time) => getDay(time))} />
      </box>
    </overlay>
  )
}

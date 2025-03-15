import { Variable } from "astal"
import { App, Astal, Gtk, Gdk } from "astal/gtk4"

const time = Variable("").poll(1000, "date")

export default function Bar(gdkmonitor: Gdk.Monitor) {
  const { TOP, LEFT, RIGHT, BOTTOM } = Astal.WindowAnchor

  return (
    <window
      visible
      anchor={TOP | RIGHT | BOTTOM}
      application={App}
      cssClasses={["Bar"]}
      exclusivity={Astal.Exclusivity.EXCLUSIVE}
      gdkmonitor={gdkmonitor}
    >
      <centerbox cssName="centerbox">
        <button hexpand halign={Gtk.Align.CENTER} onClicked="echo hello">
          Welcome to AGS!
        </button>
        <box />
        <menubutton hexpand halign={Gtk.Align.CENTER}>
          <label label={time()} />
          <popover>
            <Gtk.Calendar />
          </popover>
        </menubutton>
      </centerbox>
    </window>
  )
}

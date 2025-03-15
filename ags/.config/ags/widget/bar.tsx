import { bind, Variable } from "astal"
import { App, Astal, Gtk, Gdk } from "astal/gtk4"
import Hyprland from "gi://AstalHyprland"

const time = Variable("").poll(1000, "date")

const hyprland = Hyprland.get_default()

export function Bar(gdkmonitor: Gdk.Monitor) {
  const { TOP, LEFT, RIGHT } = Astal.WindowAnchor

  const focusedWorkspace = bind(hyprland, "focusedWorkspace")
  const id = Variable.derive([focusedWorkspace], (workspace) =>
    workspace.get_id(),
  )

  return (
    <window
      visible
      anchor={TOP | RIGHT | LEFT}
      application={App}
      cssClasses={["Bar"]}
      exclusivity={Astal.Exclusivity.EXCLUSIVE}
      gdkmonitor={gdkmonitor}
    >
      <centerbox cssName="centerbox">
        <button hexpand halign={Gtk.Align.CENTER} onClicked="echo hello">
          Welcome to AGS! {id()}
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

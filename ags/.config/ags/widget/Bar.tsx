import { Variable } from "astal"
import { App, Astal, Gtk, Gdk } from "astal/gtk4"
import Hyprland from "gi://AstalHyprland"

const time = Variable("").poll(1000, "date")

const hyprland = Hyprland.get_default()

export default function Bar(gdkmonitor: Gdk.Monitor) {
  const { TOP, LEFT, RIGHT } = Astal.WindowAnchor
  const clients = hyprland.get_clients()

  for (const client of clients) {
    console.log(client.workspace.get_id())
  }

  console.log(hyprland.get_focused_workspace().id)

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

import { bind, Variable } from "astal"
import { Gtk } from "astal/gtk4"
import AstalTray from "gi://AstalTray"

export function Tray() {
  const tray = AstalTray.get_default()

  const items = bind(tray, "items")

  const content = Variable.derive([items], (items) =>
    items.map((item) => {
      const icon = bind(item, "iconName")

      return (
        <box>
          <label label={item.get_id()}></label>
          <image iconName={icon}></image>
        </box>
      )
    }),
  )

  return <box orientation={Gtk.Orientation.VERTICAL}>{content()}</box>
}

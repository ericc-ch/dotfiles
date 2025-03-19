import { bind, Variable } from "astal"
import { Gtk } from "astal/gtk4"
import Battery from "gi://AstalBattery"
import AstalPowerProfiles from "gi://AstalPowerProfiles"

export function Power() {
  return (
    <box orientation={Gtk.Orientation.VERTICAL} spacing={4}>
      <BatteryIndicator />
      <PowerProfiles />
    </box>
  )
}

function PowerProfiles() {
  // We can move the whole state management to global scope
  // That way multiple widgets can share the same state
  // But I'm not doing it so I'm gonna put it here instead
  const powerProfiles = AstalPowerProfiles.get_default()

  // Reverse so "performance" is at the top
  const profiles = powerProfiles.get_profiles().reverse()
  const active = Variable(powerProfiles.get_active_profile())

  const setActiveProfile = (profile: string) => {
    powerProfiles.set_active_profile(profile)
    active.set(profile)
  }

  const getProfileClasses = Variable.derive([active()], (active) => {
    return (profile: string) => {
      const classes = ["power-profile"]
      if (profile === active) classes.push("active")

      return classes
    }
  })

  return (
    <box
      halign={Gtk.Align.START}
      orientation={Gtk.Orientation.VERTICAL}
      spacing={4}
    >
      {profiles.map((profile) => (
        <button
          cssClasses={getProfileClasses((func) => func(profile.profile))}
          heightRequest={32}
          widthRequest={32}
          onClicked={() => {
            setActiveProfile(profile.profile)
          }}
        >
          <label
            cssClasses={["icon"]}
            label={iconProfiles.get(profile.profile)}
          />
        </button>
      ))}
    </box>
  )
}

function BatteryIndicator() {
  const bat = Battery.get_default()

  const percentage = bind(bat, "percentage")
  const isCharging = bind(bat, "charging")
  const isPresent = bind(bat, "isPresent")

  const formatted = Variable.derive([percentage], (percentage) => {
    return formatPercentage(percentage)
  })

  const icon = Variable.derive(
    [percentage, isCharging, isPresent],
    (percentage, isCharging, isPresent) => {
      if (!isPresent) return ICON_NOT_PRESENT
      return getIcon(percentage, isCharging) ?? ICON_NOT_PRESENT
    },
  )

  return (
    <overlay cssClasses={["battery-indicator"]}>
      <label cssClasses={["icon"]} halign={Gtk.Align.START} label={icon()} />
      <label
        cssClasses={["percentage"]}
        halign={Gtk.Align.START}
        label={formatted()}
        type="overlay measure"
      />
    </overlay>
  )
}

const formatPercentage = (percentage: number) =>
  `${Math.floor(percentage * 100)}%`

const roundToNearest10 = (percentage: number) => {
  return Math.round((percentage * 100) / 10) * 10
}

const getIcon = (percentage: number, isCharging: boolean) => {
  const rounded = roundToNearest10(percentage)
  return isCharging ? iconsCharging.get(rounded) : iconsNotCharging.get(rounded)
}

const ICON_NOT_PRESENT = "󱉝"

const iconsNotCharging = new Map([
  [0, "󰂃"],
  [10, "󰂃"],
  [20, "󰂃"],
  [30, "󰁼"],
  [40, "󰁽"],
  [50, "󰁾"],
  [60, "󰁿"],
  [70, "󰂀"],
  [80, "󰂁"],
  [90, "󰂂"],
  [100, "󰁹"],
])

const iconsCharging = new Map([
  [0, "󰢟"],
  [10, "󰢜"],
  [20, "󰂆"],
  [30, "󰂇"],
  [40, "󰂈"],
  [50, "󰂈"],
  [60, "󰂉"],
  [70, "󰢞"],
  [80, "󰂊"],
  [90, "󰂋"],
  [100, "󰂅"],
])

const iconProfiles = new Map([
  ["power-saver", "󰌪"],
  ["balanced", "󰗑"],
  ["performance", "󱓞"],
])

import { bind, Variable } from "astal"
import Battery from "gi://AstalBattery"

export function BatteryIndicator() {
  const bat = Battery.get_default()
  const percentage = bind(bat, "percentage")
  const isCharging = bind(bat, "charging")
  const isPresent = bind(bat, "isPresent")

  const formatted = Variable.derive(
    [percentage, isCharging, isPresent],
    (percentage, isCharging, isPresent) => {
      if (!isPresent) return `${ICON_NOT_PRESENT} -- %`

      const icon = getIcon(percentage, isCharging)
      const percentageFormatted = formatPercentage(percentage)

      return `${icon}${percentageFormatted}`
    },
  )

  return (
    <button cssClasses={["power"]} widthRequest={80}>
      <label cssClasses={["percentage"]} label={formatted()} />
    </button>
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

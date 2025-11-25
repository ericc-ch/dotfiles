import { createSignal, onCleanup, onMount } from "solid-js"
import { useTheme } from "../../providers/theme"

const defaultLocale = Intl.DateTimeFormat().resolvedOptions().locale

const dateFormatter = new Intl.DateTimeFormat(defaultLocale, {
  year: "numeric",
  month: "short",
  day: "2-digit",
})

const timeFormatter = new Intl.DateTimeFormat(defaultLocale, {
  hour: "2-digit",
  minute: "2-digit",
})

export const Clock = () => {
  const [current, setCurrent] = createSignal(new Date())

  onMount(() => {
    const interval = setInterval(() => {
      setCurrent(new Date())
    }, 1000)

    onCleanup(() => {
      return () => clearInterval(interval)
    })
  })

  const formattedDate = () => dateFormatter.format(current())
  const formattedTime = () => timeFormatter.format(current())

  const theme = useTheme()

  return (
    <box alignItems="flex-end">
      <ascii_font
        font="block"
        text={formattedTime()}
        color={theme().fg.normal}
      />
      <ascii_font text={formattedDate()} color={theme().fg.normal} />
    </box>
  )
}

import { createSignal, onCleanup, onMount } from "solid-js"
import { useTheme } from "../../providers/theme"

const defaultLocale = Intl.DateTimeFormat().resolvedOptions().locale

const dateFormatter = new Intl.DateTimeFormat(defaultLocale, {
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

  const theme = useTheme()

  return <text fg={theme().fg.normal}>{formattedDate()}</text>
}

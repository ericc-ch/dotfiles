import { createSignal, onCleanup, onMount } from "solid-js"

const defaultLocale = Intl.DateTimeFormat().resolvedOptions().locale

const dateFormatter = new Intl.DateTimeFormat(defaultLocale, {
  year: "numeric",
  month: "short",
  day: "2-digit",
})

const timeFormatter = new Intl.DateTimeFormat(defaultLocale, {
  hour12: false,
  hour: "2-digit",
  minute: "2-digit",
  second: "2-digit",
})

export const App = () => {
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

  return (
    <box alignItems="center" justifyContent="center" flexGrow={1}>
      <box justifyContent="center" alignItems="flex-end">
        <ascii_font font="block" text={formattedTime()} />
        <ascii_font text={formattedDate()} />
      </box>
    </box>
  )
}

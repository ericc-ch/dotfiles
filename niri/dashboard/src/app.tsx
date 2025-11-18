import { createSignal, onCleanup, onMount } from "solid-js"

const defaultLocale = Intl.DateTimeFormat().resolvedOptions().locale

const formatter = new Intl.DateTimeFormat(defaultLocale, {
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
  second: "2-digit",
})

export const App = () => {
  const [date, setDate] = createSignal(new Date())

  onMount(() => {
    const interval = setInterval(() => {
      setDate(new Date())
    }, 1000)

    onCleanup(() => {
      return () => clearInterval(interval)
    })
  })

  return (
    <box alignItems="center" justifyContent="center" flexGrow={1}>
      <box justifyContent="center" alignItems="flex-end">
        <ascii_font font="tiny" text="OpenTUI" />
        <text>{defaultLocale}</text>
        <text>{date().getTime()}</text>
      </box>
    </box>
  )
}

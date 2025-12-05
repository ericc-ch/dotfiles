import { Duration, Effect, Fiber, pipe, Schedule } from "effect"
import { createSignal, onCleanup, onMount } from "solid-js"
import { AppRuntime } from "../../lib/runtime"
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
    const updateClock = pipe(
      Effect.sync(() => setCurrent(new Date())),
      Effect.repeat(Schedule.spaced(Duration.seconds(1))),
    )

    const fiber = AppRuntime.runFork(updateClock)

    onCleanup(() => {
      AppRuntime.runFork(Fiber.interrupt(fiber))
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

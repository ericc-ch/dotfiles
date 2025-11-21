import { RGBA } from "@opentui/core"
import {
  createResource,
  createSignal,
  For,
  onCleanup,
  onMount,
  Show,
} from "solid-js"
import { getDefaultSink, listSinks, setDefaultSink } from "./lib/audio"
import { useKeyboard } from "@opentui/solid"

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

  const [hoveredDevice, setHoveredDevice] = createSignal(0)

  const [defaultSink, { refetch: refetchDefaultSink }] = createResource(() =>
    getDefaultSink(),
  )
  const [sinks, { refetch: refetchSinks }] = createResource(() => listSinks())

  useKeyboard((event) => {
    if (event.name === "up") {
      setHoveredDevice((prev) => {
        const sinksCount = sinks()?.length ?? 0
        return prev > 0 ? prev - 1 : sinksCount - 1
      })
    } else if (event.name === "down") {
      setHoveredDevice((prev) => {
        const sinksCount = sinks()?.length ?? 0
        return prev < sinksCount - 1 ? prev + 1 : 0
      })
    } else if (event.name === "space") {
      const currentSinks = sinks()
      if (currentSinks && currentSinks.length > 0) {
        const selectedDevice = currentSinks[hoveredDevice()]
        if (selectedDevice) {
          setDefaultSink(selectedDevice.name)
            .then(() => {
              refetchDefaultSink()
              refetchSinks()
            })
            .catch((error) => {
              console.error("Failed to set default sink:", error)
            })
        }
      }
    }
  })

  return (
    <box alignItems="center" justifyContent="center" flexGrow={1}>
      <box alignItems="flex-end">
        <ascii_font font="block" text={formattedTime()} />
        <ascii_font text={formattedDate()} />
      </box>

      <box border position="absolute" top={0} width="100%" flexDirection="row">
        <box border={["right"]}></box>

        <Show when={Boolean(sinks())}>
          <For each={sinks()}>
            {(device, index) => (
              <box
                flexDirection="row"
                gap={2}
                backgroundColor={
                  hoveredDevice() === index() ?
                    RGBA.fromInts(100, 100, 100)
                  : RGBA.fromInts(0, 0, 0)
                }
              >
                <text
                  fg={
                    device.name === defaultSink() ?
                      RGBA.fromInts(255, 0, 0)
                    : RGBA.fromInts(255, 255, 255)
                  }
                >
                  {device.description}
                </text>
              </box>
            )}
          </For>
        </Show>
      </box>
    </box>
  )
}

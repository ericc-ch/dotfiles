import { render } from "@opentui/solid"
import { App } from "./app"
import { ConsolePosition } from "@opentui/core"
import { Providers } from "./providers/main"

render(
  () => (
    <Providers>
      <App />
    </Providers>
  ),
  {
    exitOnCtrlC: true,
    consoleOptions: {
      position: ConsolePosition.RIGHT,
    },
  },
)

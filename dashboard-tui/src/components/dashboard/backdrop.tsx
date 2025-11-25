import { RGBA } from "@opentui/core"
import type { ParentComponent } from "solid-js/types/server/rendering.js"
import { DEFAULT_COLORS, withAlpha } from "../../lib/color"

export const Backdrop: ParentComponent = (props) => {
  const transparentBg = () => withAlpha(RGBA.fromHex(DEFAULT_COLORS.black), 0.4)

  return (
    <box
      position="absolute"
      top={0}
      width="100%"
      height="100%"
      justifyContent="center"
      alignItems="center"
      backgroundColor={transparentBg()}
    >
      {props.children}
    </box>
  )
}

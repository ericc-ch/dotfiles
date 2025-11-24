import { RGBA } from "@opentui/core"
import type { ParentProps } from "solid-js"

export const Backdrop = (props: ParentProps) => {
  return (
    <box
      position="absolute"
      top={0}
      width="100%"
      height="100%"
      justifyContent="center"
      alignItems="center"
      backgroundColor={RGBA.fromValues(0, 0, 0, 0.1)}
    >
      {props.children}
    </box>
  )
}

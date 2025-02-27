Please follow the following conventions only when writing Ghostty shader (uses GLSL) code:

## GLSL Essentials

- Use GLSL syntax compatible with OpenGL 4.2
- Declare precision at the top (e.g., `precision highp float;`)
- Type all variables correctly (float, vec2, vec4)
- Add `.0` suffix for float literals (e.g., `1.0` not `1`)
- Use vector constructors appropriately: `vec4(1.0, 0.5, 0.0, 1.0)`
- Remember that GLSL is case-sensitive

## Shadertoy API Specifics

- Implement the mandatory `void mainImage(out vec4 fragColor, in vec2 fragCoord)` function
- `fragCoord` contains pixel coordinates ranging from 0.5 to resolution-0.5
- Available uniforms:
  - `uniform vec3 iResolution` - viewport resolution in pixels
  - `uniform float iTime` - shader playback time in seconds
  - `uniform float iTimeDelta` - time since last frame in seconds
  - `uniform int iFrame` - shader playback frame
  - `uniform float iChannelTime[4]` - channel playback time
  - `uniform vec4 iMouse` - mouse coordinates (xy: current, zw: click)
  - `uniform vec4 iDate` - year, month, day, time in seconds
  - `uniform float iSampleRate` - sound sample rate
  - `uniform vec3 iChannelResolution[4]` - input channel resolutions
  - `uniform samplerXX iChanneli` - input channels (textures)
- Use normalized coordinates for texture sampling: `fragCoord.xy / iResolution.xy`

## Ghostty-Specific Limitations

- Only `iChannel0` is available (terminal screen), no other channels
- Use `texture(iChannel0, uv)` to access the terminal screen content
- Consider alpha values when blending with terminal content
- Test shaders on Shadertoy first before implementing in Ghostty
- Keep a backup config file without shaders in case rendering breaks
- Shader errors will only appear in logs, not as config errors
- New windows/tabs/splits needed to see config changes

## Best Practices

- Add descriptive comments explaining the effect
- Start with simple transformations before adding complexity
- Use `mix()` for smooth color transitions
- Consider text readability when applying effects
- Use masks to apply effects selectively to background vs. text
- Handle edge cases (especially screen boundaries)
- Consider performance impact on terminal responsiveness

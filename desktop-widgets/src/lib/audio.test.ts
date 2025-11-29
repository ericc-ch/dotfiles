import { describe, expect, test } from "bun:test"
import {
  createAudioMonitor,
  getDefaultSink,
  getDefaultSinkVolume,
  getDefaultSource,
  listSinks,
  listSources,
  parseSubscribeLine,
  setDefaultSink,
  setDefaultSource,
} from "./audio"

describe("pactl utilities", () => {
  test("listSinks returns array of sink devices", async () => {
    const sinks = await listSinks()

    expect(Array.isArray(sinks)).toBe(true)
    expect(sinks.length).toBeGreaterThan(0)

    for (const sink of sinks) {
      expect(sink.type).toBe("sink")
      expect(typeof sink.index).toBe("number")
      expect(typeof sink.name).toBe("string")
      expect(typeof sink.description).toBe("string")
      expect(sink.name).toBeTruthy()
      expect(sink.description).toBeTruthy()
    }
  })

  test("listSources returns array of source devices", async () => {
    const sources = await listSources()

    expect(Array.isArray(sources)).toBe(true)
    expect(sources.length).toBeGreaterThan(0)

    for (const source of sources) {
      expect(source.type).toBe("source")
      expect(typeof source.index).toBe("number")
      expect(typeof source.name).toBe("string")
      expect(typeof source.description).toBe("string")
      expect(source.name).toBeTruthy()
      expect(source.description).toBeTruthy()
    }
  })

  test("sinks have optional volume information", async () => {
    const sinks = await listSinks()

    for (const sink of sinks) {
      if (sink.volume) {
        expect(typeof sink.volume).toBe("object")

        const channels = Object.keys(sink.volume)
        expect(channels.length).toBeGreaterThan(0)

        for (const channel of channels) {
          const vol = sink.volume[channel]
          expect(vol).toBeDefined()
          expect(typeof vol?.value).toBe("number")
          expect(typeof vol?.value_percent).toBe("string")
          expect(typeof vol?.db).toBe("string")
        }
      }
    }
  })

  test("sinks have state and mute properties", async () => {
    const sinks = await listSinks()

    for (const sink of sinks) {
      if (sink.state !== undefined) {
        expect(typeof sink.state).toBe("string")
      }

      if (sink.mute !== undefined) {
        expect(typeof sink.mute).toBe("boolean")
      }
    }
  })

  test("getDefaultSink returns default sink name", async () => {
    const defaultSinkName = await getDefaultSink()

    expect(typeof defaultSinkName).toBe("string")
    expect(defaultSinkName.length).toBeGreaterThan(0)

    // Verify the default sink exists in the list of sinks
    const sinks = await listSinks()
    const defaultSink = sinks.find((sink) => sink.name === defaultSinkName)
    expect(defaultSink).toBeDefined()
  })

  test("getDefaultSource returns default source name", async () => {
    const defaultSourceName = await getDefaultSource()

    expect(typeof defaultSourceName).toBe("string")
    expect(defaultSourceName.length).toBeGreaterThan(0)

    // Verify the default source exists in the list of sources
    const sources = await listSources()
    const defaultSource = sources.find(
      (source) => source.name === defaultSourceName,
    )
    expect(defaultSource).toBeDefined()
  })

  test("setDefaultSink changes the default sink", async () => {
    const sinks = await listSinks()
    expect(sinks.length).toBeGreaterThanOrEqual(1)

    const originalDefault = await getDefaultSink()

    // Find a different sink to set as default
    const alternativeSink = sinks.find((sink) => sink.name !== originalDefault)

    if (alternativeSink) {
      // Set the alternative sink as default
      await setDefaultSink(alternativeSink.name)

      // Verify the change
      const newDefault = await getDefaultSink()
      expect(newDefault).toBe(alternativeSink.name)

      // Restore original default
      await setDefaultSink(originalDefault)
      const restoredDefault = await getDefaultSink()
      expect(restoredDefault).toBe(originalDefault)
    } else {
      // If only one sink, just verify we can set it
      await setDefaultSink(originalDefault)
      const current = await getDefaultSink()
      expect(current).toBe(originalDefault)
    }
  })

  test("setDefaultSource changes the default source", async () => {
    const sources = await listSources()
    expect(sources.length).toBeGreaterThanOrEqual(1)

    const originalDefault = await getDefaultSource()

    // Find a different source to set as default
    const alternativeSource = sources.find(
      (source) => source.name !== originalDefault,
    )

    if (alternativeSource) {
      // Set the alternative source as default
      await setDefaultSource(alternativeSource.name)

      // Verify the change
      const newDefault = await getDefaultSource()
      expect(newDefault).toBe(alternativeSource.name)

      // Restore original default
      await setDefaultSource(originalDefault)
      const restoredDefault = await getDefaultSource()
      expect(restoredDefault).toBe(originalDefault)
    } else {
      // If only one source, just verify we can set it
      await setDefaultSource(originalDefault)
      const current = await getDefaultSource()
      expect(current).toBe(originalDefault)
    }
  })

  test("setDefaultSink throws error for invalid device", async () => {
    expect(async () => {
      await setDefaultSink("invalid_device_name_12345")
    }).toThrow()
  })

  test("setDefaultSource throws error for invalid device", async () => {
    expect(async () => {
      await setDefaultSource("invalid_device_name_12345")
    }).toThrow()
  })

  test("getDefaultSinkVolume returns volume and muted status", async () => {
    const result = await getDefaultSinkVolume()

    expect(typeof result.volume).toBe("number")
    expect(result.volume).toBeGreaterThanOrEqual(0)
    expect(result.volume).toBeLessThanOrEqual(150) // Volume can exceed 100%
    expect(typeof result.muted).toBe("boolean")
  })
})

describe("parseSubscribeLine", () => {
  test("parses sink change event", () => {
    const event = parseSubscribeLine("Event 'change' on sink #56")
    expect(event).toEqual({
      action: "change",
      object: "sink",
      index: 56,
    })
  })

  test("parses source change event", () => {
    const event = parseSubscribeLine("Event 'change' on source #57")
    expect(event).toEqual({
      action: "change",
      object: "source",
      index: 57,
    })
  })

  test("parses server change event", () => {
    const event = parseSubscribeLine("Event 'change' on server #0")
    expect(event).toEqual({
      action: "change",
      object: "server",
      index: 0,
    })
  })

  test("parses client new event", () => {
    const event = parseSubscribeLine("Event 'new' on client #123")
    expect(event).toEqual({
      action: "new",
      object: "client",
      index: 123,
    })
  })

  test("parses client remove event", () => {
    const event = parseSubscribeLine("Event 'remove' on client #123")
    expect(event).toEqual({
      action: "remove",
      object: "client",
      index: 123,
    })
  })

  test("parses card change event", () => {
    const event = parseSubscribeLine("Event 'change' on card #44")
    expect(event).toEqual({
      action: "change",
      object: "card",
      index: 44,
    })
  })

  test("parses sink-input event", () => {
    const event = parseSubscribeLine("Event 'new' on sink-input #100")
    expect(event).toEqual({
      action: "new",
      object: "sink-input",
      index: 100,
    })
  })

  test("returns null for invalid lines", () => {
    expect(parseSubscribeLine("")).toBeNull()
    expect(parseSubscribeLine("Got SIGINT, exiting.")).toBeNull()
    expect(parseSubscribeLine("random text")).toBeNull()
    expect(parseSubscribeLine("Event 'change' on sink")).toBeNull()
  })
})

describe("createAudioMonitor", () => {
  test("calls onVolumeChange with initial volume", async () => {
    let receivedVolume: { volume: number; muted: boolean } | null = null

    const stop = createAudioMonitor({
      onVolumeChange: (status) => {
        receivedVolume = status
      },
    })

    // Wait for init to complete
    await new Promise((resolve) => setTimeout(resolve, 100))

    expect(receivedVolume).not.toBeNull()
    expect(typeof receivedVolume!.volume).toBe("number")
    expect(typeof receivedVolume!.muted).toBe("boolean")

    stop()
  })

  test("stop function kills the process", async () => {
    const stop = createAudioMonitor({})

    // Wait for monitor to start
    await new Promise((resolve) => setTimeout(resolve, 100))

    // Should not throw
    stop()
  })
})

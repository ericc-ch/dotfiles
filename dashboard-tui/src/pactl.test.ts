import { describe, test, expect } from "bun:test"
import { listAudioDevices, listSinks, listSources } from "./pactl"

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

  test("listAudioDevices returns combined sinks and sources", async () => {
    const devices = await listAudioDevices()
    const sinks = devices.filter((d) => d.type === "sink")
    const sources = devices.filter((d) => d.type === "source")

    expect(Array.isArray(devices)).toBe(true)
    expect(devices.length).toBeGreaterThan(0)
    expect(sinks.length).toBeGreaterThan(0)
    expect(sources.length).toBeGreaterThan(0)
    expect(devices.length).toBe(sinks.length + sources.length)
  })

  test("devices have optional volume information", async () => {
    const devices = await listAudioDevices()

    for (const device of devices) {
      if (device.volume) {
        expect(typeof device.volume).toBe("object")

        const channels = Object.keys(device.volume)
        expect(channels.length).toBeGreaterThan(0)

        for (const channel of channels) {
          const vol = device.volume[channel]
          expect(vol).toBeDefined()
          expect(typeof vol?.value).toBe("number")
          expect(typeof vol?.value_percent).toBe("string")
          expect(typeof vol?.db).toBe("string")
        }
      }
    }
  })

  test("devices have state and mute properties", async () => {
    const devices = await listAudioDevices()

    for (const device of devices) {
      if (device.state !== undefined) {
        expect(typeof device.state).toBe("string")
      }

      if (device.mute !== undefined) {
        expect(typeof device.mute).toBe("boolean")
      }
    }
  })
})

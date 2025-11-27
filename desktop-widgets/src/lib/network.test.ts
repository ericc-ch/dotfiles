import { describe, expect, test } from "bun:test"
import {
  getActiveConnection,
  listEthernetDevices,
  listWifiNetworks,
  parseMonitorLine,
  readWifiSignal,
} from "./network"

describe("parseMonitorLine", () => {
  test("parses connected event", () => {
    const event = parseMonitorLine("wlan0: connected")
    expect(event).toEqual({ type: "connected", device: "wlan0" })
  })

  test("parses disconnected event", () => {
    const event = parseMonitorLine("wlan0: disconnected")
    expect(event).toEqual({ type: "disconnected", device: "wlan0" })
  })

  test("parses using connection event", () => {
    const event = parseMonitorLine("wlan0: using connection 'Chili'")
    expect(event).toEqual({
      type: "connecting",
      device: "wlan0",
      ssid: "Chili",
    })
  })

  test("parses connectivity event", () => {
    const event = parseMonitorLine("Connectivity is now 'full'")
    expect(event).toEqual({ type: "connectivity", connectivity: "full" })
  })

  test("parses limited connectivity", () => {
    const event = parseMonitorLine("Connectivity is now 'limited'")
    expect(event).toEqual({ type: "connectivity", connectivity: "limited" })
  })

  test("parses none connectivity", () => {
    const event = parseMonitorLine("Connectivity is now 'none'")
    expect(event).toEqual({ type: "connectivity", connectivity: "none" })
  })

  test("returns null for unrecognized lines", () => {
    expect(parseMonitorLine("NetworkManager is running")).toBeNull()
    expect(parseMonitorLine("wlan0: connecting (prepare)")).toBeNull()
    expect(parseMonitorLine("'Chili' is now the primary connection")).toBeNull()
  })

  test("handles different device names", () => {
    expect(parseMonitorLine("eth0: connected")).toEqual({
      type: "connected",
      device: "eth0",
    })
    expect(parseMonitorLine("enp3s0: disconnected")).toEqual({
      type: "disconnected",
      device: "enp3s0",
    })
  })

  test("handles SSID with special characters", () => {
    const event = parseMonitorLine("wlan0: using connection 'My Network 5G'")
    expect(event).toEqual({
      type: "connecting",
      device: "wlan0",
      ssid: "My Network 5G",
    })
  })
})

describe("readWifiSignal", () => {
  test("returns signal strength or null", async () => {
    const signal = await readWifiSignal()

    // May be null if wifi is not available
    if (signal === null) {
      expect(signal).toBeNull()
      return
    }

    expect(typeof signal).toBe("number")
    expect(signal).toBeGreaterThanOrEqual(0)
    expect(signal).toBeLessThanOrEqual(100)
  })

  test("returns null for non-existent device", async () => {
    const signal = await readWifiSignal("nonexistent0")
    expect(signal).toBeNull()
  })
})

describe("network utilities", () => {
  test("getActiveConnection returns network status or null", async () => {
    const connection = await getActiveConnection()

    // May be null if no network connection
    if (connection === null) {
      expect(connection).toBeNull()
      return
    }

    expect(typeof connection.name).toBe("string")
    expect(connection.name).toBeTruthy()
    expect(typeof connection.device).toBe("string")
    expect(connection.device).toBeTruthy()
    expect(["wifi", "ethernet", "other"]).toContain(connection.type)
  })

  test("wifi connection has signal and wifi-specific fields", async () => {
    const connection = await getActiveConnection()

    if (connection === null || connection.type !== "wifi") {
      // Skip if not on wifi
      return
    }

    expect(typeof connection.signal).toBe("number")
    expect(connection.signal).toBeGreaterThanOrEqual(0)
    expect(connection.signal).toBeLessThanOrEqual(100)

    if (connection.rate) {
      expect(typeof connection.rate).toBe("string")
    }

    if (connection.frequency) {
      expect(typeof connection.frequency).toBe("string")
    }

    if (connection.channel) {
      expect(typeof connection.channel).toBe("number")
    }

    if (connection.security) {
      expect(typeof connection.security).toBe("string")
    }
  })

  test("listWifiNetworks returns array of wifi networks", async () => {
    const networks = await listWifiNetworks()

    expect(Array.isArray(networks)).toBe(true)

    for (const network of networks) {
      expect(typeof network.ssid).toBe("string")
      expect(network.ssid).toBeTruthy()
      expect(typeof network.bssid).toBe("string")
      expect(network.bssid).toBeTruthy()
      expect(typeof network.signal).toBe("number")
      expect(network.signal).toBeGreaterThanOrEqual(0)
      expect(network.signal).toBeLessThanOrEqual(100)
      expect(typeof network.active).toBe("boolean")

      if (network.rate) {
        expect(typeof network.rate).toBe("string")
      }

      if (network.frequency) {
        expect(typeof network.frequency).toBe("string")
      }

      if (network.channel) {
        expect(typeof network.channel).toBe("number")
      }

      if (network.security) {
        expect(typeof network.security).toBe("string")
      }
    }
  })

  test("listWifiNetworks has at most one active network", async () => {
    const networks = await listWifiNetworks()
    const activeCount = networks.filter((n) => n.active).length

    expect(activeCount).toBeLessThanOrEqual(1)
  })

  test("listEthernetDevices returns array of ethernet devices", async () => {
    const devices = await listEthernetDevices()

    expect(Array.isArray(devices)).toBe(true)

    for (const device of devices) {
      expect(typeof device.device).toBe("string")
      expect(device.device).toBeTruthy()
      expect(["connected", "disconnected", "unavailable"]).toContain(
        device.state,
      )

      if (device.connection) {
        expect(typeof device.connection).toBe("string")
      }

      if (device.speed) {
        expect(typeof device.speed).toBe("number")
        expect(device.speed).toBeGreaterThan(0)
      }
    }
  })
})

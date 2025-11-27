import { describe, expect, test } from "bun:test"
import {
  getActiveConnection,
  listEthernetDevices,
  listWifiNetworks,
} from "./network"

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

import { describe, test, expect } from "bun:test"
import { debounce } from "./debounce"

describe("debounce", () => {
  test("calls callback after wait time", async () => {
    let called = false
    const fn = debounce(() => {
      called = true
    }, 100)

    fn()
    expect(called).toBe(false)

    await new Promise((resolve) => setTimeout(resolve, 150))
    expect(called).toBe(true)
  })

  test("cancels previous timeout on multiple calls", async () => {
    let count = 0
    const fn = debounce(() => {
      count++
    }, 100)

    fn()
    fn()
    fn()

    await new Promise((resolve) => setTimeout(resolve, 150))
    expect(count).toBe(1)
  })

  test("clear cancels timeout", async () => {
    let called = false
    const fn = debounce(() => {
      called = true
    }, 100)

    fn()
    fn.clear()

    await new Promise((resolve) => setTimeout(resolve, 150))
    expect(called).toBe(false)
  })

  test("passes arguments to callback", async () => {
    let result = ""
    const fn = debounce((msg: string) => {
      result = msg
    }, 100)

    fn("hello")

    await new Promise((resolve) => setTimeout(resolve, 150))
    expect(result).toBe("hello")
  })

  test("uses last arguments when called multiple times", async () => {
    let result = ""
    const fn = debounce((msg: string) => {
      result = msg
    }, 100)

    fn("first")
    fn("second")
    fn("third")

    await new Promise((resolve) => setTimeout(resolve, 150))
    expect(result).toBe("third")
  })
})

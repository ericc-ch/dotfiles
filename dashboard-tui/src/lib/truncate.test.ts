import { describe, test, expect } from "bun:test"
import { truncate } from "./truncate"

describe("truncate", () => {
  test("returns original string if shorter than maxLength", () => {
    expect(truncate("Hello", 10)).toBe("Hello")
    expect(truncate("Hi", 5)).toBe("Hi")
  })

  test("returns original string if equal to maxLength", () => {
    expect(truncate("Hello", 5)).toBe("Hello")
    expect(truncate("12345", 5)).toBe("12345")
    expect(truncate("abc", 3)).toBe("abc")
  })

  test("truncates and adds ellipsis when exceeding maxLength", () => {
    expect(truncate("Hello World", 8)).toBe("Hello...")
    expect(truncate("This is a long string", 10)).toBe("This is...")
  })

  test("handles very short maxLength", () => {
    expect(truncate("Hello", 3)).toBe("...")
    expect(truncate("Hello", 4)).toBe("H...")
  })

  test("handles maxLength less than ellipsis length", () => {
    expect(truncate("Hello", 2)).toBe("..")
    expect(truncate("Hello", 1)).toBe(".")
    expect(truncate("Hello", 0)).toBe("")
  })

  test("result never exceeds maxLength", () => {
    const testCases = [
      { str: "Hello World", maxLength: 8 },
      { str: "Long string here", maxLength: 5 },
      { str: "Test", maxLength: 10 },
      { str: "Another test case", maxLength: 12 },
    ]

    testCases.forEach(({ str, maxLength }) => {
      const result = truncate(str, maxLength)
      expect(result.length).toBeLessThanOrEqual(maxLength)
    })
  })

  test("handles empty string", () => {
    expect(truncate("", 5)).toBe("")
    expect(truncate("", 0)).toBe("")
  })
})

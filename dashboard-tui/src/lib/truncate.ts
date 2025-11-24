/**
 * Truncates a string to a maximum length, adding ellipsis if needed.
 * Ensures the total length (text + ellipsis) does not exceed maxLength.
 *
 * @param str - The string to truncate
 * @param maxLength - Maximum length including ellipsis
 * @returns Truncated string with ellipsis if needed
 *
 * @example
 * truncate("Hello World", 8) // "Hello..."
 * truncate("Hi", 10) // "Hi"
 */
export function truncate(str: string, maxLength: number): string {
  if (str.length <= maxLength) {
    return str
  }

  const ellipsis = "..."
  const truncateAt = maxLength - ellipsis.length

  if (truncateAt <= 0) {
    return ellipsis.slice(0, maxLength)
  }

  return str.slice(0, truncateAt) + ellipsis
}

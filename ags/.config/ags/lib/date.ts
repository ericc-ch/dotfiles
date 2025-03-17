export const getDay = (date: Date) =>
  date.toLocaleString("en-US", { weekday: "short" })

export const isWeekend = (date: Date) =>
  date.getDay() === 0 || date.getDay() === 6

export const formatTime = (date: Date) =>
  date.toLocaleTimeString("en-ID", {
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  })

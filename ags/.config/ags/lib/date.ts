export const getDay = (date: Date) =>
  date.toLocaleString("en-US", { weekday: "short" })

export const isWeekend = (date: Date) =>
  date.getDay() === 0 || date.getDay() === 6

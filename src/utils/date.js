export function formatDate(date) {
  const value = date instanceof Date ? date : new Date(date)
  const year = value.getFullYear()
  const month = String(value.getMonth() + 1).padStart(2, '0')
  const day = String(value.getDate()).padStart(2, '0')
  return `${year}-${month}-${day}`
}

export function monthRange(date = new Date()) {
  const start = new Date(date.getFullYear(), date.getMonth(), 1)
  const end = new Date(date.getFullYear(), date.getMonth() + 1, 0)
  return { startDate: formatDate(start), endDate: formatDate(end) }
}

export function yearRange(year) {
  return { startDate: formatDate(new Date(year, 0, 1)), endDate: formatDate(new Date(year, 11, 31)) }
}

export function weekRange(date = new Date()) {
  const value = new Date(date.getFullYear(), date.getMonth(), date.getDate())
  const offset = (value.getDay() + 6) % 7
  value.setDate(value.getDate() - offset)
  const end = new Date(value.getFullYear(), value.getMonth(), value.getDate() + 6)
  return { startDate: formatDate(value), endDate: formatDate(end) }
}

export function weekRangesInMonth(year, monthIndex) {
  const monthStart = new Date(year, monthIndex, 1)
  const monthEnd = new Date(year, monthIndex + 1, 0)
  const firstWeek = weekRange(monthStart)
  const cursor = new Date(Number(firstWeek.startDate.slice(0, 4)), Number(firstWeek.startDate.slice(5, 7)) - 1, Number(firstWeek.startDate.slice(8, 10)))
  const weeks = []
  while (cursor <= monthEnd) {
    const range = weekRange(cursor)
    weeks.push(range)
    cursor.setDate(cursor.getDate() + 7)
  }
  return weeks
}

export function formatAmount(value) {
  return Number(value || 0).toFixed(2)
}

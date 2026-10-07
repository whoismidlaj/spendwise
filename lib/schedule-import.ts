export type ScheduleRow = { dueDate: string; amount: string; principal: string; interest: string }
type Row = ScheduleRow

// Accepts "date, amount, principal, interest" per line (comma, tab or semicolon separated; ISO or DD/MM/YYYY dates).
export function parseSchedule(text: string): Row[] {
  const rows: Row[] = []
  for (const line of text.split('\n')) {
    const cells = line.split(/[\t,;]/).map(cell => cell.trim().replace(/[₹$,]/g, ''))
    if (cells.length < 2) continue
    let date = cells[0]
    const dmy = date.match(/^(\d{1,2})[/-](\d{1,2})[/-](\d{4})$/)
    if (dmy) date = `${dmy[3]}-${dmy[2].padStart(2, '0')}-${dmy[1].padStart(2, '0')}`
    if (!/^\d{4}-\d{2}-\d{2}$/.test(date) || Number.isNaN(Number(cells[1]))) continue
    rows.push({ dueDate: date, amount: cells[1], principal: cells[2] ?? '', interest: cells[3] ?? '' })
  }
  return rows
}


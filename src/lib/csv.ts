/**
 * A CSV reader that handles what real exports actually contain.
 *
 * Splitting on commas is not enough: Hevy puts exercise notes in the file, and
 * a note can contain a comma, a quote mark, or a line break. All three appear
 * in ordinary use ("3x5, felt heavy", 'called the "hip hinge"', a multi-line
 * note), and each one silently shifts every later column if the parser is
 * naive — which shows up as an import that looks fine and is wrong.
 *
 * Follows RFC 4180: fields may be quoted, a quote inside a quoted field is
 * written "", and a quoted field may span newlines.
 */

/** Delimiters worth guessing between. Semicolons appear in European exports. */
const DELIMITERS = [',', ';', '\t'] as const

/**
 * Pick the delimiter by counting candidates outside quotes on the header line.
 * Counting the header rather than the whole file keeps a comma-heavy notes
 * column from outvoting a semicolon that is doing the actual separating.
 */
export function detectDelimiter(text: string): string {
  const header = readFirstLine(text)
  let best = ','
  let bestCount = 0

  for (const delimiter of DELIMITERS) {
    let count = 0
    let quoted = false
    for (let i = 0; i < header.length; i++) {
      const ch = header[i]
      if (ch === '"') quoted = !quoted
      else if (ch === delimiter && !quoted) count++
    }
    if (count > bestCount) {
      best = delimiter
      bestCount = count
    }
  }

  return best
}

/** The header, respecting quoted newlines — a quoted field can span lines. */
function readFirstLine(text: string): string {
  let quoted = false
  for (let i = 0; i < text.length; i++) {
    const ch = text[i]
    if (ch === '"') quoted = !quoted
    else if ((ch === '\n' || ch === '\r') && !quoted) return text.slice(0, i)
  }
  return text
}

/** Every row as an array of fields, quotes resolved. Blank rows are dropped. */
export function parseCsv(text: string, delimiter = detectDelimiter(text)): string[][] {
  // A BOM survives Excel round-trips and would otherwise become part of the
  // first header's name, so nothing matches it.
  const input = text.charCodeAt(0) === 0xfeff ? text.slice(1) : text

  const rows: string[][] = []
  let row: string[] = []
  let field = ''
  let quoted = false
  let i = 0

  const endField = () => {
    row.push(field)
    field = ''
  }
  const endRow = () => {
    endField()
    // A trailing newline produces one empty field, which is not a row.
    if (row.length > 1 || row[0] !== '') rows.push(row)
    row = []
  }

  while (i < input.length) {
    const ch = input[i]

    if (quoted) {
      if (ch === '"') {
        if (input[i + 1] === '"') {
          field += '"'
          i += 2
          continue
        }
        quoted = false
        i++
        continue
      }
      field += ch
      i++
      continue
    }

    if (ch === '"' && field === '') {
      quoted = true
      i++
      continue
    }
    if (ch === delimiter) {
      endField()
      i++
      continue
    }
    if (ch === '\r') {
      // \r\n is one break, a lone \r (old Mac exports) is also one.
      if (input[i + 1] === '\n') i++
      endRow()
      i++
      continue
    }
    if (ch === '\n') {
      endRow()
      i++
      continue
    }

    field += ch
    i++
  }

  if (field !== '' || row.length > 0) endRow()
  return rows
}

/**
 * Rows keyed by header name, normalised to lowercase-with-underscores so
 * "Exercise Name", "exercise_name" and "EXERCISE NAME" are one key.
 */
export interface CsvTable {
  headers: string[]
  rows: Record<string, string>[]
}

export function normaliseHeader(header: string): string {
  return header
    .trim()
    .toLowerCase()
    .replace(/[\s-]+/g, '_')
    .replace(/[^a-z0-9_]/g, '')
}

export function toTable(text: string): CsvTable {
  const rows = parseCsv(text)
  if (rows.length === 0) return { headers: [], rows: [] }

  const headers = rows[0].map(normaliseHeader)

  return {
    headers,
    rows: rows.slice(1).map((cells) => {
      const record: Record<string, string> = {}
      headers.forEach((header, index) => {
        // A duplicate header would otherwise clobber the first of its name.
        if (header && !(header in record)) record[header] = (cells[index] ?? '').trim()
      })
      return record
    }),
  }
}

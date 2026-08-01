import { profileReportSchema, type ProfileReport } from '@/lib/artifacts/registry'

/**
 * Offline profiling. Stage 3 must never require a live warehouse connection, so a CSV extract is a
 * first-class input: upload it, and the statistics the exit criteria check are computed here.
 */

export class CsvError extends Error {
  constructor(message: string) {
    super(message)
    this.name = 'CsvError'
  }
}

/** RFC 4180-ish reader: quoted fields, escaped quotes, CRLF or LF. */
export function parseCsv(text: string): { headers: string[]; rows: string[][] } {
  const rows: string[][] = []
  let row: string[] = []
  let field = ''
  let inQuotes = false

  for (let index = 0; index < text.length; index += 1) {
    const char = text[index]
    if (inQuotes) {
      if (char === '"') {
        if (text[index + 1] === '"') {
          field += '"'
          index += 1
        } else {
          inQuotes = false
        }
      } else {
        field += char
      }
      continue
    }
    if (char === '"') {
      inQuotes = true
    } else if (char === ',') {
      row.push(field)
      field = ''
    } else if (char === '\n' || char === '\r') {
      if (char === '\r' && text[index + 1] === '\n') index += 1
      row.push(field)
      field = ''
      if (row.some((cell) => cell.trim() !== '')) rows.push(row)
      row = []
    } else {
      field += char
    }
  }
  row.push(field)
  if (row.some((cell) => cell.trim() !== '')) rows.push(row)

  const headers = rows.shift()?.map((header) => header.trim()) ?? []
  if (headers.length === 0 || headers.every((header) => header === '')) {
    throw new CsvError('The first row must be a header row of column names.')
  }
  const duplicates = headers.filter((header, index) => headers.indexOf(header) !== index)
  if (duplicates.length > 0) {
    throw new CsvError(`Duplicate column name(s) in the header: ${[...new Set(duplicates)].join(', ')}.`)
  }
  return { headers, rows }
}

const ISO_DATE = /^\d{4}-\d{2}-\d{2}(?:[T ]\d{2}:\d{2}(?::\d{2})?)?/
const NUMERIC = /^-?\d+(?:\.\d+)?$/
const BOOLEAN = /^(?:true|false|yes|no|y|n)$/i
const EMAIL = /^[^@\s]+@[^@\s]+\.[^@\s]+$/
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

function inferDatatype(values: string[]): string {
  if (values.length === 0) return 'string'
  if (values.every((value) => NUMERIC.test(value))) {
    return values.every((value) => !value.includes('.')) ? 'integer' : 'decimal'
  }
  if (values.every((value) => BOOLEAN.test(value))) return 'boolean'
  if (values.every((value) => ISO_DATE.test(value))) {
    return values.every((value) => value.length <= 10) ? 'date' : 'timestamp'
  }
  return 'string'
}

function inferPattern(values: string[]): string {
  if (values.length === 0) return ''
  if (values.every((value) => EMAIL.test(value))) return 'email'
  if (values.every((value) => UUID.test(value))) return 'uuid'
  if (values.every((value) => ISO_DATE.test(value))) return 'ISO 8601'
  if (values.every((value) => NUMERIC.test(value))) return 'numeric'
  if (values.every((value) => /^[A-Za-z0-9_-]+$/.test(value))) return 'alphanumeric'
  return 'free text'
}

function extremes(values: string[], datatype: string): { min: string; max: string } {
  if (values.length === 0) return { min: '', max: '' }
  if (datatype === 'integer' || datatype === 'decimal') {
    const numbers = values.map(Number).filter((value) => Number.isFinite(value))
    if (numbers.length === 0) return { min: '', max: '' }
    return { min: String(Math.min(...numbers)), max: String(Math.max(...numbers)) }
  }
  const sorted = [...values].sort()
  return { min: sorted[0] ?? '', max: sorted[sorted.length - 1] ?? '' }
}

export interface CsvProfileOptions {
  sourceName: string
  /** Include one example value per column. Off by default — samples are the riskiest field here. */
  includeSamples?: boolean
  profiledAt?: string
}

export type ProfileDataset = ProfileReport['datasets'][number]

export function profileCsv(text: string, options: CsvProfileOptions): ProfileDataset {
  const { headers, rows } = parseCsv(text)
  if (rows.length === 0) {
    throw new CsvError('The file has a header row but no data rows to profile.')
  }

  const columns = headers.map((header, columnIndex) => {
    const raw = rows.map((row) => (row[columnIndex] ?? '').trim())
    const present = raw.filter((value) => value !== '')
    const datatype = inferDatatype(present)
    const { min, max } = extremes(present, datatype)
    return {
      name: header,
      datatype,
      rowCount: rows.length,
      nullRate: Number(((rows.length - present.length) / rows.length).toFixed(4)),
      distinctCount: new Set(present).size,
      min,
      max,
      pattern: inferPattern(present),
      sample: options.includeSamples ? (present[0] ?? '') : '',
    }
  })

  return { source: options.sourceName, rowCount: rows.length, columns }
}

/**
 * Merge a profiled dataset into an existing profile report, replacing any dataset already recorded
 * for the same source so re-uploading a corrected extract does not duplicate it.
 */
export function mergeProfileDataset(
  existing: unknown,
  dataset: ProfileDataset,
  profiledAt: string,
): ProfileReport {
  const parsed = profileReportSchema.safeParse(existing)
  const datasets = parsed.success ? parsed.data.datasets.filter((entry) => entry.source !== dataset.source) : []
  return profileReportSchema.parse({ profiledAt, datasets: [...datasets, dataset] })
}

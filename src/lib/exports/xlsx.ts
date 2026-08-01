import ExcelJS from 'exceljs'
import { SENSITIVITY, type Sensitivity } from '@/lib/domain/enums'
import { attributeRegisterSchema, type AttributeRegister } from '@/lib/artifacts/registry'

/**
 * The attribute register workbook. SMEs will not review 200 attributes in a web form, so the
 * workbook is the review surface: colour-coded input columns, dropdown validation, a locked
 * reference sheet, a COUNTIFS-driven review summary and a parking-lot tab.
 *
 * The workbook is lossless — every field of the register has a column — so an edited workbook can
 * be imported back as a new artifact version. See `parseAttributeWorkbook`.
 */

/** Column order is load-bearing: the import reads by header name, the formulas read by letter. */
const COLUMNS = [
  { header: 'Attribute', key: 'name', width: 28 },
  { header: 'Entity', key: 'entity', width: 20 },
  { header: 'Business definition', key: 'businessDefinition', width: 60 },
  { header: 'Source lineage', key: 'sourceLineage', width: 34 },
  { header: 'Datatype', key: 'datatype', width: 14 },
  { header: 'Nullable', key: 'nullable', width: 10 },
  { header: 'Allowed values', key: 'allowedValues', width: 24 },
  { header: 'Sensitivity', key: 'sensitivity', width: 16 },
  { header: 'PII', key: 'pii', width: 8 },
  { header: 'Regulatory flags', key: 'regulatoryFlags', width: 26 },
  { header: 'Derivation', key: 'derivation', width: 30 },
  { header: 'Steward', key: 'steward', width: 20 },
  { header: 'Pattern exposure', key: 'patternExposure', width: 30 },
  { header: 'Reviewed?', key: 'reviewed', width: 14 },
  { header: 'Reviewer comment', key: 'comment', width: 44 },
] as const

const COLUMN_LETTER = {
  nullable: 'F',
  sensitivity: 'H',
  pii: 'I',
  reviewed: 'N',
} as const

/** Columns a reviewer is expected to change are tinted so the review surface is obvious. */
const INPUT_COLUMNS = ['C', 'H', 'I', 'N', 'O']

function list(values: string[]): string {
  return values.join(', ')
}

function parseList(value: string): string[] {
  return value
    .split(/[,;]/)
    .map((entry) => entry.trim())
    .filter(Boolean)
}

export async function buildAttributeWorkbook(params: {
  productName: string
  register: AttributeRegister
  patternKeys: string[]
}): Promise<Buffer> {
  const workbook = new ExcelJS.Workbook()
  workbook.creator = 'Agentic Data Product Management'
  workbook.created = new Date()

  const sheet = workbook.addWorksheet('Attributes', { views: [{ state: 'frozen', ySplit: 1 }] })
  sheet.columns = COLUMNS.map((column) => ({ ...column }))
  sheet.getRow(1).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF2B3242' } }
  sheet.getRow(1).font = { bold: true, color: { argb: 'FFFFFFFF' } }

  for (const attribute of params.register.attributes) {
    sheet.addRow({
      name: attribute.name,
      entity: attribute.entity,
      businessDefinition: attribute.businessDefinition,
      sourceLineage: attribute.sourceLineage,
      datatype: attribute.datatype,
      nullable: attribute.nullable ? 'YES' : 'NO',
      allowedValues: attribute.allowedValues,
      sensitivity: attribute.sensitivity,
      pii: attribute.pii ? 'YES' : 'NO',
      regulatoryFlags: list(attribute.regulatoryFlags),
      derivation: attribute.derivation,
      steward: attribute.steward,
      patternExposure: list(attribute.patternExposure),
      reviewed: '',
      comment: '',
    })
  }

  const lastRow = Math.max(sheet.rowCount, 2)
  for (let row = 2; row <= lastRow; row += 1) {
    for (const column of INPUT_COLUMNS) {
      sheet.getCell(`${column}${row}`).fill = {
        type: 'pattern',
        pattern: 'solid',
        fgColor: { argb: 'FFFDF6E3' },
      }
    }
    sheet.getCell(`${COLUMN_LETTER.nullable}${row}`).dataValidation = {
      type: 'list',
      allowBlank: false,
      formulae: ['"YES,NO"'],
    }
    sheet.getCell(`${COLUMN_LETTER.sensitivity}${row}`).dataValidation = {
      type: 'list',
      allowBlank: false,
      formulae: [`"${SENSITIVITY.join(',')}"`],
    }
    sheet.getCell(`${COLUMN_LETTER.pii}${row}`).dataValidation = {
      type: 'list',
      allowBlank: false,
      formulae: ['"YES,NO"'],
    }
    sheet.getCell(`${COLUMN_LETTER.reviewed}${row}`).dataValidation = {
      type: 'list',
      allowBlank: true,
      formulae: ['"APPROVED,CHANGES REQUESTED"'],
    }
  }

  const reference = workbook.addWorksheet('Reference')
  reference.columns = [
    { header: 'Field', key: 'field', width: 24 },
    { header: 'Allowed values / meaning', key: 'meaning', width: 80 },
  ]
  reference.getRow(1).font = { bold: true }
  reference.addRows([
    { field: 'Sensitivity', meaning: SENSITIVITY.join(', ') },
    { field: 'PII', meaning: 'YES if the attribute identifies a person directly or in combination.' },
    { field: 'Reviewed?', meaning: 'APPROVED or CHANGES REQUESTED. Blank means not yet reviewed.' },
    { field: 'Regulatory flags', meaning: 'Comma-separated control keys from the workspace pack.' },
    { field: 'Pattern exposure', meaning: `Comma-separated. Known patterns: ${params.patternKeys.join(', ')}` },
    {
      field: 'Reminder',
      meaning:
        'Every attribute must carry a sensitivity classification before the Stage 9 gate can open.',
    },
    {
      field: 'Importing',
      meaning:
        'Edit and re-import this workbook in the Lifecycle Studio. It commits a new artifact version; reviewer comments become review-thread comments anchored to the attribute.',
    },
  ])
  reference.protect('adpm-reference', { selectLockedCells: true, selectUnlockedCells: true })

  const summary = workbook.addWorksheet('Review summary')
  summary.columns = [
    { header: 'Measure', key: 'measure', width: 40 },
    { header: 'Value', key: 'value', width: 20 },
  ]
  summary.getRow(1).font = { bold: true }
  summary.addRow({ measure: 'Attributes', value: { formula: `COUNTA(Attributes!A2:A${lastRow})` } })
  summary.addRow({
    measure: 'Approved',
    value: { formula: `COUNTIF(Attributes!${COLUMN_LETTER.reviewed}2:${COLUMN_LETTER.reviewed}${lastRow},"APPROVED")` },
  })
  summary.addRow({
    measure: 'Changes requested',
    value: {
      formula: `COUNTIF(Attributes!${COLUMN_LETTER.reviewed}2:${COLUMN_LETTER.reviewed}${lastRow},"CHANGES REQUESTED")`,
    },
  })
  summary.addRow({
    measure: 'Not yet reviewed',
    value: { formula: `COUNTBLANK(Attributes!${COLUMN_LETTER.reviewed}2:${COLUMN_LETTER.reviewed}${lastRow})` },
  })
  summary.addRow({
    measure: 'Flagged as PII',
    value: { formula: `COUNTIF(Attributes!${COLUMN_LETTER.pii}2:${COLUMN_LETTER.pii}${lastRow},"YES")` },
  })
  summary.addRow({
    measure: 'Restricted',
    value: {
      formula: `COUNTIF(Attributes!${COLUMN_LETTER.sensitivity}2:${COLUMN_LETTER.sensitivity}${lastRow},"RESTRICTED")`,
    },
  })

  const parkingLot = workbook.addWorksheet('Parking lot')
  parkingLot.columns = [
    { header: 'Item', key: 'item', width: 70 },
    { header: 'Raised by', key: 'raisedBy', width: 24 },
  ]
  parkingLot.getRow(1).font = { bold: true }
  for (const item of params.register.parkingLot) {
    parkingLot.addRow({ item: item.item, raisedBy: item.raisedBy })
  }

  const buffer = await workbook.xlsx.writeBuffer()
  return Buffer.from(buffer)
}

export interface WorkbookReviewNote {
  attributeName: string
  rowIndex: number
  outcome: 'APPROVED' | 'CHANGES REQUESTED' | ''
  comment: string
}

export interface ParsedAttributeWorkbook {
  register: AttributeRegister
  reviews: WorkbookReviewNote[]
  approved: number
  changesRequested: number
  notReviewed: number
}

export class WorkbookImportError extends Error {
  constructor(
    message: string,
    readonly issues: string[] = [],
  ) {
    super(message)
    this.name = 'WorkbookImportError'
  }
}

function cellText(row: ExcelJS.Row, index: number): string {
  const value = row.getCell(index).value
  if (value === null || value === undefined) return ''
  if (typeof value === 'object') {
    if ('text' in value && typeof value.text === 'string') return value.text.trim()
    if ('result' in value) return String(value.result ?? '').trim()
    if ('richText' in value && Array.isArray(value.richText)) {
      return value.richText.map((part) => part.text).join('').trim()
    }
    return ''
  }
  return String(value).trim()
}

function yesNo(value: string, field: string, rowIndex: number): boolean {
  const normalised = value.toUpperCase()
  if (normalised === 'YES' || normalised === 'TRUE') return true
  if (normalised === 'NO' || normalised === 'FALSE') return false
  throw new WorkbookImportError(`Row ${rowIndex}: ${field} must be YES or NO, found "${value}".`)
}

/**
 * The other half of the round trip: read an edited workbook back into a validated register.
 * Reviewer outcomes and comments come back with it so the review does not stay trapped in a file.
 */
export async function parseAttributeWorkbook(data: ArrayBuffer): Promise<ParsedAttributeWorkbook> {
  const workbook = new ExcelJS.Workbook()
  await workbook.xlsx.load(data)

  const sheet = workbook.getWorksheet('Attributes')
  if (!sheet) {
    throw new WorkbookImportError(
      'That workbook has no "Attributes" sheet. Export the register first, edit it, then re-import.',
    )
  }

  const headerRow = sheet.getRow(1)
  const headerIndex = new Map<string, number>()
  headerRow.eachCell((cell, columnNumber) => {
    headerIndex.set(String(cell.value ?? '').trim().toLowerCase(), columnNumber)
  })
  const column = (key: (typeof COLUMNS)[number]['header']): number => {
    const index = headerIndex.get(key.toLowerCase())
    if (!index) {
      throw new WorkbookImportError(`That workbook is missing the "${key}" column.`)
    }
    return index
  }

  const attributes: AttributeRegister['attributes'] = []
  const reviews: WorkbookReviewNote[] = []
  const issues: string[] = []

  for (let rowIndex = 2; rowIndex <= sheet.rowCount; rowIndex += 1) {
    const row = sheet.getRow(rowIndex)
    const name = cellText(row, column('Attribute'))
    if (!name) continue

    const sensitivity = cellText(row, column('Sensitivity')).toUpperCase()
    if (!SENSITIVITY.includes(sensitivity as Sensitivity)) {
      issues.push(`Row ${rowIndex} (${name}): sensitivity "${sensitivity}" is not one of ${SENSITIVITY.join(', ')}.`)
      continue
    }

    attributes.push({
      name,
      entity: cellText(row, column('Entity')),
      businessDefinition: cellText(row, column('Business definition')),
      sourceLineage: cellText(row, column('Source lineage')),
      datatype: cellText(row, column('Datatype')),
      nullable: yesNo(cellText(row, column('Nullable')), 'Nullable', rowIndex),
      allowedValues: cellText(row, column('Allowed values')),
      sensitivity: sensitivity as Sensitivity,
      pii: yesNo(cellText(row, column('PII')), 'PII', rowIndex),
      regulatoryFlags: parseList(cellText(row, column('Regulatory flags'))),
      derivation: cellText(row, column('Derivation')),
      steward: cellText(row, column('Steward')),
      patternExposure: parseList(cellText(row, column('Pattern exposure'))),
    })

    const outcome = cellText(row, column('Reviewed?')).toUpperCase()
    const comment = cellText(row, column('Reviewer comment'))
    if (outcome || comment) {
      reviews.push({
        attributeName: name,
        rowIndex,
        outcome: outcome === 'APPROVED' || outcome === 'CHANGES REQUESTED' ? outcome : '',
        comment,
      })
    }
  }

  if (issues.length > 0) {
    throw new WorkbookImportError('The workbook has values the register will not accept.', issues)
  }

  const parkingLotSheet = workbook.getWorksheet('Parking lot')
  const parkingLot: AttributeRegister['parkingLot'] = []
  if (parkingLotSheet) {
    for (let rowIndex = 2; rowIndex <= parkingLotSheet.rowCount; rowIndex += 1) {
      const row = parkingLotSheet.getRow(rowIndex)
      const item = cellText(row, 1)
      if (!item) continue
      parkingLot.push({ item, raisedBy: cellText(row, 2) })
    }
  }

  const parsed = attributeRegisterSchema.safeParse({ attributes, parkingLot })
  if (!parsed.success) {
    throw new WorkbookImportError(
      'The imported register failed schema validation.',
      parsed.error.issues.map((issue) => `${issue.path.join('.') || '(root)'}: ${issue.message}`),
    )
  }

  return {
    register: parsed.data,
    reviews,
    approved: reviews.filter((review) => review.outcome === 'APPROVED').length,
    changesRequested: reviews.filter((review) => review.outcome === 'CHANGES REQUESTED').length,
    notReviewed: attributes.length - reviews.filter((review) => review.outcome).length,
  }
}

export async function buildPortfolioWorkbook(rows: Record<string, string | number>[]): Promise<Buffer> {
  const workbook = new ExcelJS.Workbook()
  workbook.creator = 'Agentic Data Product Management'
  const sheet = workbook.addWorksheet('Portfolio')
  const keys = rows[0] ? Object.keys(rows[0]) : ['product']
  sheet.columns = keys.map((key) => ({ header: key, key, width: Math.max(14, key.length + 4) }))
  sheet.getRow(1).font = { bold: true }
  for (const row of rows) sheet.addRow(row)
  const buffer = await workbook.xlsx.writeBuffer()
  return Buffer.from(buffer)
}

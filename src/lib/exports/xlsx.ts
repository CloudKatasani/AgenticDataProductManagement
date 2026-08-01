import ExcelJS from 'exceljs'
import { SENSITIVITY } from '@/lib/domain/enums'
import type { AttributeRegister } from '@/lib/artifacts/registry'

/**
 * The attribute register workbook. SMEs will not review 200 attributes in a web form, so the
 * workbook is the review surface: colour-coded input columns, dropdown validation, a locked
 * reference sheet, a COUNTIFS-driven review summary and a parking-lot tab.
 */
export async function buildAttributeWorkbook(params: {
  productName: string
  register: AttributeRegister
  patternKeys: string[]
}): Promise<Buffer> {
  const workbook = new ExcelJS.Workbook()
  workbook.creator = 'Agentic Data Product Management'
  workbook.created = new Date()

  const sheet = workbook.addWorksheet('Attributes', { views: [{ state: 'frozen', ySplit: 1 }] })
  sheet.columns = [
    { header: 'Attribute', key: 'name', width: 28 },
    { header: 'Entity', key: 'entity', width: 20 },
    { header: 'Business definition', key: 'businessDefinition', width: 60 },
    { header: 'Source lineage', key: 'sourceLineage', width: 34 },
    { header: 'Datatype', key: 'datatype', width: 14 },
    { header: 'Nullable', key: 'nullable', width: 10 },
    { header: 'Sensitivity', key: 'sensitivity', width: 16 },
    { header: 'PII', key: 'pii', width: 8 },
    { header: 'Derivation', key: 'derivation', width: 30 },
    { header: 'Steward', key: 'steward', width: 20 },
    { header: 'Reviewed?', key: 'reviewed', width: 12 },
    { header: 'Reviewer comment', key: 'comment', width: 40 },
  ]

  sheet.getRow(1).font = { bold: true }
  sheet.getRow(1).fill = {
    type: 'pattern',
    pattern: 'solid',
    fgColor: { argb: 'FF2B3242' },
  }
  sheet.getRow(1).font = { bold: true, color: { argb: 'FFFFFFFF' } }

  for (const attribute of params.register.attributes) {
    sheet.addRow({
      name: attribute.name,
      entity: attribute.entity,
      businessDefinition: attribute.businessDefinition,
      sourceLineage: attribute.sourceLineage,
      datatype: attribute.datatype,
      nullable: attribute.nullable ? 'YES' : 'NO',
      sensitivity: attribute.sensitivity,
      pii: attribute.pii ? 'YES' : 'NO',
      derivation: attribute.derivation,
      steward: attribute.steward,
      reviewed: '',
      comment: '',
    })
  }

  const lastRow = sheet.rowCount
  // Colour-code the columns a reviewer is expected to change.
  for (let row = 2; row <= lastRow; row += 1) {
    for (const column of ['C', 'G', 'H', 'K', 'L']) {
      sheet.getCell(`${column}${row}`).fill = {
        type: 'pattern',
        pattern: 'solid',
        fgColor: { argb: 'FFFDF6E3' },
      }
    }
    sheet.getCell(`F${row}`).dataValidation = {
      type: 'list',
      allowBlank: false,
      formulae: ['"YES,NO"'],
    }
    sheet.getCell(`G${row}`).dataValidation = {
      type: 'list',
      allowBlank: false,
      formulae: [`"${SENSITIVITY.join(',')}"`],
    }
    sheet.getCell(`H${row}`).dataValidation = {
      type: 'list',
      allowBlank: false,
      formulae: ['"YES,NO"'],
    }
    sheet.getCell(`K${row}`).dataValidation = {
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
    {
      field: 'Consumption patterns',
      meaning: params.patternKeys.join(', '),
    },
    {
      field: 'Reminder',
      meaning:
        'Every attribute must carry a sensitivity classification before the Stage 9 gate can open.',
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
    value: { formula: `COUNTIF(Attributes!K2:K${lastRow},"APPROVED")` },
  })
  summary.addRow({
    measure: 'Changes requested',
    value: { formula: `COUNTIF(Attributes!K2:K${lastRow},"CHANGES REQUESTED")` },
  })
  summary.addRow({
    measure: 'Not yet reviewed',
    value: { formula: `COUNTBLANK(Attributes!K2:K${lastRow})` },
  })
  summary.addRow({
    measure: 'Flagged as PII',
    value: { formula: `COUNTIF(Attributes!H2:H${lastRow},"YES")` },
  })
  summary.addRow({
    measure: 'Restricted',
    value: { formula: `COUNTIF(Attributes!G2:G${lastRow},"RESTRICTED")` },
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

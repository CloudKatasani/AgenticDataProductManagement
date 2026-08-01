import ExcelJS from 'exceljs'
import { describe, expect, it } from 'vitest'
import { buildAttributeWorkbook, parseAttributeWorkbook, WorkbookImportError } from '@/lib/exports/xlsx'
import { attributeRegisterSchema } from '@/lib/artifacts/registry'
import { CsvError, mergeProfileDataset, parseCsv, profileCsv } from '@/lib/profiling/csv'
import { PATTERN_KEYS } from '@/lib/patterns/registry'
import { prisma } from '@/lib/db'
import { blueprintArtifacts, commit, createFixture, createProduct } from './helpers/fixtures'

const register = attributeRegisterSchema.parse({
  attributes: [
    {
      name: 'account_id',
      entity: 'Account',
      businessDefinition: 'The identifier issued by the billing system for each account.',
      sourceLineage: 'SAP IS-U.account.account_id',
      datatype: 'string',
      nullable: false,
      allowedValues: '',
      sensitivity: 'INTERNAL',
      pii: false,
      regulatoryFlags: [],
      derivation: '',
      steward: 'Priya Raman',
      patternExposure: ['certified-dashboard', 'self-serve-exploration'],
    },
    {
      name: 'contact_email',
      entity: 'Customer',
      businessDefinition: 'The email address recorded against the customer of record.',
      sourceLineage: 'CIS.customer.email',
      datatype: 'string',
      nullable: true,
      allowedValues: 'RFC 5322 address',
      sensitivity: 'RESTRICTED',
      pii: true,
      regulatoryFlags: ['pii-minimisation', 'consent-marketing'],
      derivation: 'Lower-cased on load',
      steward: 'Priya Raman',
      patternExposure: ['certified-dashboard'],
    },
  ],
  parkingLot: [{ item: 'Confirm whether dormant accounts keep a contact email', raisedBy: 'Tom Whitfield' }],
})

async function withReviewCells(
  buffer: Buffer,
  edits: { row: number; outcome?: string; comment?: string; definition?: string }[],
): Promise<ArrayBuffer> {
  const workbook = new ExcelJS.Workbook()
  await workbook.xlsx.load(new Uint8Array(buffer).buffer as ArrayBuffer)
  const sheet = workbook.getWorksheet('Attributes')!
  for (const edit of edits) {
    if (edit.outcome !== undefined) sheet.getCell(`N${edit.row}`).value = edit.outcome
    if (edit.comment !== undefined) sheet.getCell(`O${edit.row}`).value = edit.comment
    if (edit.definition !== undefined) sheet.getCell(`C${edit.row}`).value = edit.definition
  }
  const out = await workbook.xlsx.writeBuffer()
  return out as ArrayBuffer
}

describe('attribute register Excel round trip', () => {
  it('survives export and import without losing a field', async () => {
    const buffer = await buildAttributeWorkbook({
      productName: 'Arrears',
      register,
      patternKeys: [...PATTERN_KEYS],
    })
    const parsed = await parseAttributeWorkbook(new Uint8Array(buffer).buffer as ArrayBuffer)
    expect(parsed.register).toEqual(register)
  })

  it('carries reviewer outcomes and comments back out of the workbook', async () => {
    const buffer = await buildAttributeWorkbook({
      productName: 'Arrears',
      register,
      patternKeys: [...PATTERN_KEYS],
    })
    const edited = await withReviewCells(buffer, [
      { row: 2, outcome: 'APPROVED' },
      { row: 3, outcome: 'CHANGES REQUESTED', comment: 'This is the billing email, not the contact email.' },
    ])

    const parsed = await parseAttributeWorkbook(edited)
    expect(parsed.approved).toBe(1)
    expect(parsed.changesRequested).toBe(1)
    expect(parsed.reviews).toHaveLength(2)
    expect(parsed.reviews.find((review) => review.attributeName === 'contact_email')?.comment).toContain(
      'billing email',
    )
  })

  it('carries an edited definition back as new content', async () => {
    const buffer = await buildAttributeWorkbook({
      productName: 'Arrears',
      register,
      patternKeys: [...PATTERN_KEYS],
    })
    const edited = await withReviewCells(buffer, [
      { row: 2, definition: 'The identifier issued by the billing system, unique for the life of the account.' },
    ])
    const parsed = await parseAttributeWorkbook(edited)
    expect(parsed.register.attributes[0]?.businessDefinition).toContain('unique for the life')
  })

  it('refuses a workbook whose sensitivity value is not a permitted classification', async () => {
    const buffer = await buildAttributeWorkbook({
      productName: 'Arrears',
      register,
      patternKeys: [...PATTERN_KEYS],
    })
    const workbook = new ExcelJS.Workbook()
    await workbook.xlsx.load(new Uint8Array(buffer).buffer as ArrayBuffer)
    workbook.getWorksheet('Attributes')!.getCell('H2').value = 'SECRET-ISH'
    const edited = (await workbook.xlsx.writeBuffer()) as ArrayBuffer

    await expect(parseAttributeWorkbook(edited)).rejects.toBeInstanceOf(WorkbookImportError)
  })

  it('refuses a file that is not an attribute register workbook', async () => {
    const workbook = new ExcelJS.Workbook()
    workbook.addWorksheet('Something else')
    const buffer = (await workbook.xlsx.writeBuffer()) as ArrayBuffer
    await expect(parseAttributeWorkbook(buffer)).rejects.toThrow(/Attributes/)
  })
})

describe('CSV profiling — offline, no warehouse connection', () => {
  const csv = [
    'account_id,arrears_balance,protected_flag,opened_at,contact_email',
    'A-1,120.50,true,2024-01-05,nadia@example.com',
    'A-2,0,false,2024-02-11,tom@example.com',
    'A-3,,true,2024-03-02,',
    'A-4,88.25,false,2024-04-19,lena@example.com',
  ].join('\n')

  it('parses quoted fields, embedded commas and escaped quotes', () => {
    const { headers, rows } = parseCsv('a,b\n"one, two","he said ""hi"""\n')
    expect(headers).toEqual(['a', 'b'])
    expect(rows[0]).toEqual(['one, two', 'he said "hi"'])
  })

  it('rejects a header row with duplicate column names', () => {
    expect(() => parseCsv('a,a\n1,2\n')).toThrow(CsvError)
  })

  it('rejects a file with no data rows', () => {
    expect(() => profileCsv('a,b\n', { sourceName: 'Extract' })).toThrow(CsvError)
  })

  it('computes the statistics the Stage 3 exit criteria actually check', () => {
    const dataset = profileCsv(csv, { sourceName: 'Billing extract' })
    expect(dataset.source).toBe('Billing extract')
    expect(dataset.rowCount).toBe(4)

    const balance = dataset.columns.find((column) => column.name === 'arrears_balance')!
    expect(balance.datatype).toBe('decimal')
    expect(balance.nullRate).toBeCloseTo(0.25, 5)
    expect(balance.min).toBe('0')
    expect(balance.max).toBe('120.5')

    const flag = dataset.columns.find((column) => column.name === 'protected_flag')!
    expect(flag.datatype).toBe('boolean')
    expect(flag.distinctCount).toBe(2)

    const opened = dataset.columns.find((column) => column.name === 'opened_at')!
    expect(opened.datatype).toBe('date')

    const email = dataset.columns.find((column) => column.name === 'contact_email')!
    expect(email.pattern).toBe('email')
    expect(email.nullRate).toBeCloseTo(0.25, 5)
  })

  it('withholds sample values unless they are explicitly requested', () => {
    const without = profileCsv(csv, { sourceName: 'Billing extract' })
    expect(without.columns.every((column) => column.sample === '')).toBe(true)

    const withSamples = profileCsv(csv, { sourceName: 'Billing extract', includeSamples: true })
    expect(withSamples.columns.find((column) => column.name === 'contact_email')?.sample).toBe(
      'nadia@example.com',
    )
  })

  it('replaces rather than duplicates a dataset when the same source is re-profiled', () => {
    const first = profileCsv(csv, { sourceName: 'Billing extract' })
    const report = mergeProfileDataset(undefined, first, '2026-08-01')
    expect(report.datasets).toHaveLength(1)

    const second = profileCsv(`${csv}\nA-5,10,true,2024-05-01,sam@example.com`, {
      sourceName: 'Billing extract',
    })
    const merged = mergeProfileDataset(report, second, '2026-08-02')
    expect(merged.datasets).toHaveLength(1)
    expect(merged.datasets[0]?.rowCount).toBe(5)
    expect(merged.profiledAt).toBe('2026-08-02')

    const other = profileCsv(csv, { sourceName: 'Customer master' })
    const both = mergeProfileDataset(merged, other, '2026-08-02')
    expect(both.datasets.map((dataset) => dataset.source).sort()).toEqual([
      'Billing extract',
      'Customer master',
    ])
  })
})

describe('imports commit real artifact versions', () => {
  it('commits an imported workbook as a new attribute-register version', async () => {
    const fixture = await createFixture()
    const product = await createProduct(fixture)
    const artifacts = blueprintArtifacts(fixture)
    const first = await commit(fixture, product.id, 'attribute-register', artifacts['attribute-register'])

    const seeded = attributeRegisterSchema.parse(artifacts['attribute-register'])
    const buffer = await buildAttributeWorkbook({
      productName: 'Seeded',
      register: seeded,
      patternKeys: [...PATTERN_KEYS],
    })
    const edited = await withReviewCells(buffer, [
      { row: 2, definition: 'Reviewed by the steward and rewritten for a non-technical reader.' },
      { row: 2, outcome: 'CHANGES REQUESTED', comment: 'Confirm this matches the billing system.' },
    ])

    const parsed = await parseAttributeWorkbook(edited)
    const second = await commit(fixture, product.id, 'attribute-register', parsed.register)

    expect(second.version).toBe(first.version + 1)
    const stored = await prisma.artifactVersion.findFirstOrThrow({
      where: { artifactId: second.artifactId },
      orderBy: { version: 'desc' },
    })
    expect(stored.contentJson).toContain('non-technical reader')
    expect(parsed.changesRequested).toBe(1)
  })

  it('commits a CSV-profiled dataset as a profile-report version', async () => {
    const fixture = await createFixture()
    const product = await createProduct(fixture)
    const dataset = profileCsv('id,amount\n1,10\n2,\n3,30\n', { sourceName: 'Billing extract' })
    const report = mergeProfileDataset(undefined, dataset, '2026-08-01')

    const result = await commit(fixture, product.id, 'profile-report', report)
    expect(result.version).toBe(1)

    const stored = await prisma.artifactVersion.findFirstOrThrow({
      where: { artifactId: result.artifactId },
    })
    const content = JSON.parse(stored.contentJson) as { datasets: { source: string }[] }
    expect(content.datasets[0]?.source).toBe('Billing extract')
  })
})

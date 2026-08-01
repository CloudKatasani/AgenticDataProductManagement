'use client'

import { useActionState } from 'react'
import {
  importAttributeWorkbookAction,
  importProfileCsvAction,
  type Result,
} from '@/app/(app)/products/actions'
import { Button, Card, CardBody, CardHeader, ErrorText, Field, LinkButton, inputClass } from '@/components/ui'

function Banner({ result }: { result: Result | undefined }) {
  if (!result) return null
  return (
    <div className="mt-3">
      {result.ok ? (
        <p role="status" className="rounded-md border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm text-emerald-800">
          {result.ok}
        </p>
      ) : null}
      {result.error ? (
        <ErrorText>
          {result.error}
          {result.details?.length ? (
            <ul className="mt-1 list-disc pl-5">
              {result.details.slice(0, 12).map((detail) => (
                <li key={detail}>{detail}</li>
              ))}
            </ul>
          ) : null}
        </ErrorText>
      ) : null}
    </div>
  )
}

/** Stage 5: export the register, review it in Excel, import it back as a new version. */
export function AttributeWorkbookRoundTrip({ productId }: { productId: string }) {
  const [result, formAction, pending] = useActionState<Result | undefined, FormData>(
    importAttributeWorkbookAction,
    undefined,
  )
  return (
    <Card>
      <CardHeader
        title="Attribute register — Excel round trip"
        description="SMEs will not review 200 attributes in a web form. Export the workbook, review it, and import it back: the edits become a new version and the reviewer comments become anchored review comments."
        actions={<LinkButton href={`/api/export/attributes/${productId}`}>Export workbook</LinkButton>}
      />
      <CardBody>
        <form action={formAction}>
          <input type="hidden" name="productId" value={productId} />
          <Field
            label="Edited workbook (.xlsx)"
            htmlFor="workbook-file"
            hint="Keep the Attributes sheet and its column headers; everything else can be edited."
            required
          >
            <input
              id="workbook-file"
              name="file"
              type="file"
              accept=".xlsx,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
              required
              className={inputClass}
            />
          </Field>
          <Button disabled={pending} variant="secondary">
            {pending ? 'Importing…' : 'Import workbook'}
          </Button>
          <Banner result={result} />
        </form>
      </CardBody>
    </Card>
  )
}

/** Stage 3: profile a CSV extract offline. No warehouse connection exists in this flow. */
export function CsvProfiler({ productId }: { productId: string }) {
  const [result, formAction, pending] = useActionState<Result | undefined, FormData>(
    importProfileCsvAction,
    undefined,
  )
  return (
    <Card>
      <CardHeader
        title="Profile a CSV extract"
        description="Profiling never requires a live warehouse connection. Upload an extract and the row counts, null rates, cardinality, ranges and patterns the exit criteria check are computed here."
      />
      <CardBody>
        <form action={formAction}>
          <input type="hidden" name="productId" value={productId} />
          <Field
            label="Source name"
            htmlFor="csv-source"
            hint="Must match a source in the Stage 3 inventory, or the exit criteria will still flag it as unprofiled."
            required
          >
            <input id="csv-source" name="sourceName" className={inputClass} required />
          </Field>
          <Field label="CSV extract" htmlFor="csv-file" required>
            <input
              id="csv-file"
              name="file"
              type="file"
              accept=".csv,text/csv"
              required
              className={inputClass}
            />
          </Field>
          <label className="mb-3 flex items-center gap-2 text-sm text-ink-700">
            <input type="checkbox" name="includeSamples" value="true" />
            Store one example value per column
            <span className="text-xs text-ink-500">
              (off by default — samples are the riskiest field in a profile)
            </span>
          </label>
          <Button disabled={pending} variant="secondary">
            {pending ? 'Profiling…' : 'Profile and commit'}
          </Button>
          <Banner result={result} />
        </form>
      </CardBody>
    </Card>
  )
}

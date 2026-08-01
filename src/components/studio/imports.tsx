'use client'

import { useActionState, useState } from 'react'
import {
  importAttributeWorkbookAction,
  importExternalMetadataAction,
  importProfileCsvAction,
  type Result,
} from '@/app/(app)/products/actions'
import {
  Badge,
  Button,
  Card,
  CardBody,
  CardHeader,
  ErrorText,
  Field,
  LinkButton,
  inputClass,
} from '@/components/ui'

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

/**
 * Stages 3, 4 and 6: bring in what your modelling and catalogue tools already know, so the
 * agents chartered for those stages have context before they propose anything.
 */
export function ExternalMetadataImporter({
  productId,
  connectors,
  existing,
}: {
  productId: string
  connectors: {
    key: string
    name: string
    vendor: string
    category: string
    fileTypes: string[]
    howToExport: string
    note: string
    verified: boolean
  }[]
  existing: { id: string; connectorName: string; summary: string; fileName: string; importedOn: string }[]
}) {
  const [result, formAction, pending] = useActionState<Result | undefined, FormData>(
    importExternalMetadataAction,
    undefined,
  )
  const [connectorKey, setConnectorKey] = useState(connectors[0]?.key ?? '')
  const connector = connectors.find((c) => c.key === connectorKey)

  return (
    <Card>
      <CardHeader
        title="Import from your modelling and catalogue tools"
        description="erwin, Collibra, Alation or any tool that can emit the canonical format. What you import becomes context the chartered agents read before they propose — it never becomes artifact content, and nothing is committed."
      />
      <CardBody>
        <form action={formAction}>
          <input type="hidden" name="productId" value={productId} />
          <Field label="Tool" htmlFor="connector-key" required>
            <select
              id="connector-key"
              name="connectorKey"
              className={inputClass}
              value={connectorKey}
              onChange={(event) => setConnectorKey(event.target.value)}
              required
            >
              {connectors.map((c) => (
                <option key={c.key} value={c.key}>
                  {c.name} — {c.vendor}
                </option>
              ))}
            </select>
          </Field>
          {connector ? (
            <div className="mb-3 rounded-md border border-ink-200 bg-ink-50 px-3 py-2 text-xs text-ink-700">
              <p>
                <strong>How to export:</strong> {connector.howToExport}
              </p>
              <p className="mt-1">
                <Badge tone={connector.verified ? 'good' : 'warn'}>
                  {connector.verified ? 'format fully specified' : 'unverified against a live instance'}
                </Badge>{' '}
                {connector.note}
              </p>
            </div>
          ) : null}
          <Field
            label="Export file"
            htmlFor="metadata-file"
            hint={connector ? `Accepts ${connector.fileTypes.join(', ')}` : undefined}
            required
          >
            <input
              id="metadata-file"
              name="file"
              type="file"
              accept={connector?.fileTypes.join(',')}
              required
              className={inputClass}
            />
          </Field>
          <Button disabled={pending} variant="secondary">
            {pending ? 'Importing…' : 'Import metadata'}
          </Button>
          <Banner result={result} />
        </form>

        {existing.length > 0 ? (
          <div className="mt-4 border-t border-ink-200 pt-3">
            <p className="text-xs font-medium uppercase tracking-wide text-ink-500">
              Imported for this product
            </p>
            <ul className="mt-2 space-y-1 text-xs text-ink-700">
              {existing.map((item) => (
                <li key={item.id}>
                  <span className="font-medium">{item.connectorName}</span> — {item.summary}{' '}
                  <span className="text-ink-500">
                    ({item.fileName || 'no filename'}, {item.importedOn})
                  </span>
                </li>
              ))}
            </ul>
            <p className="mt-2 text-xs text-ink-500">
              Re-importing supersedes an earlier export from the same tool rather than duplicating
              it. Imports are append-only and appear in the audit trail.
            </p>
          </div>
        ) : null}
      </CardBody>
    </Card>
  )
}

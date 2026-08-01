import { NextResponse } from 'next/server'
import { prisma } from '@/lib/db'
import { sessionOrNull } from '@/lib/auth/session'
import { buildAttributeWorkbook } from '@/lib/exports/xlsx'
import { attributeRegisterSchema } from '@/lib/artifacts/registry'
import { PATTERN_KEYS } from '@/lib/patterns/registry'

export async function GET(_request: Request, context: { params: Promise<{ id: string }> }) {
  const session = await sessionOrNull()
  if (!session) return NextResponse.json({ error: 'Not signed in.' }, { status: 401 })
  const { id } = await context.params

  const product = await prisma.dataProduct.findUnique({
    where: { id },
    include: {
      artifacts: {
        where: { type: 'attribute-register' },
        include: { versions: { orderBy: { version: 'desc' }, take: 1 } },
      },
    },
  })
  if (!product || product.workspaceId !== session.workspaceId) {
    return NextResponse.json({ error: 'Not found in this workspace.' }, { status: 404 })
  }

  const version = product.artifacts[0]?.versions[0]
  if (!version) {
    return NextResponse.json({ error: 'No attribute register has been committed yet.' }, { status: 409 })
  }
  const parsed = attributeRegisterSchema.safeParse(JSON.parse(version.contentJson))
  if (!parsed.success) {
    return NextResponse.json({ error: 'The committed attribute register failed validation.' }, { status: 422 })
  }

  const buffer = await buildAttributeWorkbook({
    productName: product.name,
    register: parsed.data,
    patternKeys: [...PATTERN_KEYS],
  })

  return new NextResponse(new Uint8Array(buffer), {
    headers: {
      'content-type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      'content-disposition': `attachment; filename="${product.key}-attribute-register.xlsx"`,
    },
  })
}

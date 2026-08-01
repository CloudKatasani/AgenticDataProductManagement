import { PDFDocument, StandardFonts, rgb } from 'pdf-lib'

/**
 * PDF rendering without a headless browser, so nothing here needs network or a Chromium binary.
 * Used for the printable Academy primer and any other single-page handout.
 */
export async function buildPrimerPdf(params: {
  title: string
  subtitle: string
  sections: { title: string; body: string }[]
  footer: string
}): Promise<Buffer> {
  const pdf = await PDFDocument.create()
  const font = await pdf.embedFont(StandardFonts.Helvetica)
  const bold = await pdf.embedFont(StandardFonts.HelveticaBold)

  const pageWidth = 595.28
  const pageHeight = 841.89
  const margin = 56
  const maxWidth = pageWidth - margin * 2

  let page = pdf.addPage([pageWidth, pageHeight])
  let cursor = pageHeight - margin

  const wrap = (text: string, size: number, typeface: typeof font): string[] => {
    const words = text.split(/\s+/)
    const lines: string[] = []
    let line = ''
    for (const word of words) {
      const candidate = line ? `${line} ${word}` : word
      if (typeface.widthOfTextAtSize(candidate, size) > maxWidth) {
        if (line) lines.push(line)
        line = word
      } else {
        line = candidate
      }
    }
    if (line) lines.push(line)
    return lines
  }

  const write = (text: string, size: number, typeface: typeof font, gap = 4) => {
    for (const line of wrap(text, size, typeface)) {
      if (cursor < margin + size) {
        page = pdf.addPage([pageWidth, pageHeight])
        cursor = pageHeight - margin
      }
      page.drawText(line, {
        x: margin,
        y: cursor,
        size,
        font: typeface,
        color: rgb(0.11, 0.13, 0.19),
      })
      cursor -= size + gap
    }
  }

  write(params.title, 20, bold, 8)
  write(params.subtitle, 11, font, 14)

  for (const section of params.sections) {
    cursor -= 6
    write(section.title, 13, bold, 6)
    write(section.body, 10.5, font, 5)
  }

  cursor -= 10
  write(params.footer, 9, font, 4)

  const bytes = await pdf.save()
  return Buffer.from(bytes)
}

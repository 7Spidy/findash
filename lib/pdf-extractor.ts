'use client'

export interface ExtractionResult {
  text: string
  pageCount: number
  passwordUsed: boolean
  /** True when the PDF appears to be a scanned image rather than text-layer.
   *  Detected by averaging fewer than 80 characters per page after extraction. */
  isLikelyImageBased: boolean
}

export class PasswordRequiredError extends Error {
  constructor() {
    super('Password required')
    this.name = 'PasswordRequiredError'
  }
}

export async function extractPdfText(
  file: File,
  password?: string
): Promise<ExtractionResult> {
  const pdfjsLib = await import('pdfjs-dist')
  pdfjsLib.GlobalWorkerOptions.workerSrc = '/pdf.worker.min.mjs'

  const arrayBuffer = await file.arrayBuffer()
  const uint8Array = new Uint8Array(arrayBuffer)

  let pdf
  try {
    pdf = await pdfjsLib.getDocument({
      data: uint8Array,
      password: password ?? '',
    }).promise
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err)
    if (msg.includes('Password') || msg.includes('password') || (err as { name?: string }).name === 'PasswordException') {
      throw new PasswordRequiredError()
    }
    throw err
  }

  const pages: string[] = []
  for (let i = 1; i <= pdf.numPages; i++) {
    const page = await pdf.getPage(i)
    const content = await page.getTextContent()
    const pageText = content.items
      .map((item) => ('str' in item ? item.str : ''))
      .join(' ')
    pages.push(pageText)
  }

  const text = pages.join('\n\n--- PAGE BREAK ---\n\n')
  const avgCharsPerPage = pdf.numPages > 0 ? text.trim().length / pdf.numPages : 0
  const isLikelyImageBased = pdf.numPages > 1 && avgCharsPerPage < 80

  return {
    text,
    pageCount: pdf.numPages,
    passwordUsed: !!password,
    isLikelyImageBased,
  }
}

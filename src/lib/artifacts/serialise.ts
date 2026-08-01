import { stringify as yamlStringify, parse as yamlParse } from 'yaml'
import { getArtifactType, type ArtifactFormat } from './registry'

/**
 * Serialisation for the git-friendly `workspace/` mirror and for export. The database always
 * stores canonical JSON; these functions produce the human- and diff-friendly rendering.
 */

interface MarkdownShaped {
  markdown: string
}
interface DiagramShaped {
  diagram: string
}

function isMarkdownShaped(value: unknown): value is MarkdownShaped {
  return !!value && typeof value === 'object' && typeof (value as MarkdownShaped).markdown === 'string'
}

function isDiagramShaped(value: unknown): value is DiagramShaped {
  return !!value && typeof value === 'object' && typeof (value as DiagramShaped).diagram === 'string'
}

export function serialiseContent(content: unknown, format: ArtifactFormat): string {
  switch (format) {
    case 'yaml':
      return yamlStringify(content, { lineWidth: 100 })
    case 'json':
      return `${JSON.stringify(content, null, 2)}\n`
    case 'markdown':
      return isMarkdownShaped(content) ? `${content.markdown}\n` : `${String(content)}\n`
    case 'mermaid':
      return isDiagramShaped(content) ? `${content.diagram}\n` : `${String(content)}\n`
  }
}

export function serialiseArtifact(artifactType: string, content: unknown): string {
  return serialiseContent(content, getArtifactType(artifactType).format)
}

export function deserialiseYaml(text: string): unknown {
  return yamlParse(text)
}

/** Path of an artifact inside the git-friendly workspace mirror. */
export function mirrorPathFor(productKey: string, artifactType: string): string {
  return `workspace/${productKey}/${getArtifactType(artifactType).fileName}`
}

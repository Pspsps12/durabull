import { readFile, readdir } from 'node:fs/promises'
import { resolve } from 'node:path'
import { createSearchAPI, type Index } from 'fumadocs-core/search/server'

export const dynamic = 'force-static'

const docsRoot = resolve(process.cwd(), 'content/documentation')

function toTitleCase(segment: string): string {
  return segment
    .split('-')
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(' ')
}

function parseFrontmatter(content: string): { frontmatter: Record<string, string>; body: string } {
  const match = content.match(/^---\n([\s\S]*?)\n---\n?/)
  if (!match) return { frontmatter: {}, body: content }

  const frontmatter: Record<string, string> = {}
  for (const line of match[1].split('\n')) {
    const kv = line.match(/^([A-Za-z0-9_]+):\s*(.*)$/)
    if (!kv) continue
    const key = kv[1]
    const value = kv[2].replace(/^['"]|['"]$/g, '').trim()
    frontmatter[key] = value
  }

  return {
    frontmatter,
    body: content.slice(match[0].length),
  }
}

function stripMdxSyntax(content: string): string {
  return content
    .replace(/```[\s\S]*?```/g, ' ')
    .replace(/`[^`]*`/g, ' ')
    .replace(/\[([^\]]+)\]\([^)]+\)/g, '$1')
    .replace(/<[^>]+>/g, ' ')
    .replace(/[#>*_~|-]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
}

function relativePathToUrl(relativePath: string): string {
  if (relativePath === 'index.mdx') return '/documentation'
  return `/documentation/${relativePath.replace(/\.mdx$/, '')}`
}

async function collectMdxFiles(dir: string): Promise<string[]> {
  const entries = await readdir(dir, { withFileTypes: true })
  const files: string[] = []

  for (const entry of entries) {
    const fullPath = resolve(dir, entry.name)

    if (entry.isDirectory()) {
      files.push(...(await collectMdxFiles(fullPath)))
      continue
    }

    if (!entry.isFile() || !entry.name.endsWith('.mdx')) continue
    files.push(fullPath)
  }

  return files
}

async function buildIndexes(): Promise<Index[]> {
  const files = await collectMdxFiles(docsRoot)
  const indexes: Index[] = []

  for (const fullPath of files) {
    const relativePath = fullPath.replace(`${docsRoot}/`, '')
    const raw = await readFile(fullPath, 'utf8')
    const { frontmatter, body } = parseFrontmatter(raw)
    const title =
      frontmatter.title ||
      toTitleCase(
        relativePath
          .replace(/\.mdx$/, '')
          .split('/')
          .pop()!
      )
    const description = frontmatter.description
    const content = stripMdxSyntax(body)
    const segments = relativePath.split('/').slice(0, -1)
    const breadcrumbs = ['Documentation', ...segments.map(toTitleCase)]

    indexes.push({
      title,
      description,
      breadcrumbs,
      content,
      url: relativePathToUrl(relativePath),
      keywords: `${title} ${description ?? ''}`.trim(),
    })
  }

  return indexes
}

const searchAPI = createSearchAPI('simple', {
  indexes: () => buildIndexes(),
})

export const GET = process.env.NEXT_OUTPUT === 'export' ? searchAPI.staticGET : searchAPI.GET

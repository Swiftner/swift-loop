// src/ui/library/loader.ts
import { libraryEntries } from './index'
import type { LibraryEntry } from './types'

export const library: LibraryEntry[] = [...libraryEntries].sort((a, b) => a.name.localeCompare(b.name))

export function libraryById(id: string): LibraryEntry | undefined {
  return library.find(e => e.id === id)
}

export function libraryTags(): string[] {
  const set = new Set<string>()
  for (const e of library) for (const t of e.tags ?? []) set.add(t)
  return [...set].sort()
}

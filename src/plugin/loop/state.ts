// src/plugin/loop/state.ts

export interface LastRunRecord {
  originalId: string
  parentId: string
  cloneIds: string[]
  groupId: string
}

export class LastRunStore {
  private record: LastRunRecord | null = null

  set(record: LastRunRecord): void {
    this.record = record
  }

  get(): LastRunRecord | null {
    return this.record
  }

  clear(): void {
    this.record = null
  }
}

/**
 * Simple fs-based JSON store.
 *
 * electron-store v10+ is ESM-only and cannot be loaded in Vite's
 * CJS-bundled Electron main process.  The usage here is trivial
 * (single "sessionHistory" key), so a lightweight replacement
 * removes the dependency entirely.
 */
import { app } from "electron"
import path from "path"
import fs from "fs"

// ─── Types ──────────────────────────────────────────────────────────

export interface SessionWorkspaceSnapshot {
  type: "solution" | "debug"
  code?: string
  keyPoints?: string[]
  timeComplexity?: string
  spaceComplexity?: string
  issues?: string[]
  fixes?: string[]
  why?: string[]
  verify?: string[]
}

export interface StoredSnippet {
  id: string
  question: string
  answer: string
  timestamp: number
  tags: string[]
  workspace?: SessionWorkspaceSnapshot
}

export interface StoredSession {
  id: string
  date: number
  company?: string
  role?: string
  snippets: StoredSnippet[]
  notes?: string
}

interface StoreSchema {
  sessionHistory: StoredSession[]
}

// ─── Simple JSON Store ──────────────────────────────────────────────

const DEFAULTS: StoreSchema = { sessionHistory: [] }
const MAX_SESSION_HISTORY = 30

function getStorePath(): string {
  return path.join(app.getPath("userData"), "session-history.json")
}

function readStore(): StoreSchema {
  try {
    const raw = fs.readFileSync(getStorePath(), "utf-8")
    const parsed = JSON.parse(raw) as Partial<StoreSchema>
    return { ...DEFAULTS, ...parsed }
  } catch {
    return { ...DEFAULTS }
  }
}

function writeStore(data: StoreSchema): void {
  try {
    const dir = path.dirname(getStorePath())
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true })
    }
    fs.writeFileSync(getStorePath(), JSON.stringify(data, null, 2), "utf-8")
  } catch (error) {
    console.error("[store] Failed to write store:", error)
  }
}

// Public typed store interface (compatible with previous electron-store usage)
const store = {
  get<K extends keyof StoreSchema>(key: K): StoreSchema[K] {
    return readStore()[key]
  },
  set<K extends keyof StoreSchema>(key: K, value: StoreSchema[K]): void {
    const data = readStore()
    data[key] = value
    writeStore(data)
  },
  clear(): void {
    writeStore({ ...DEFAULTS })
  }
}

// ─── Helpers ────────────────────────────────────────────────────────

const randomId = (prefix: string) =>
  `${prefix}_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`

const normalizeHistory = (value: unknown): StoredSession[] => {
  if (!Array.isArray(value)) {
    return []
  }
  return value as StoredSession[]
}

// ─── Exported API (unchanged signatures) ────────────────────────────

export const getSessionHistory = (): StoredSession[] => {
  const sessionHistory = normalizeHistory(store.get("sessionHistory"))
  return sessionHistory.sort((a, b) => b.date - a.date)
}

export const getSessionHistoryItem = (sessionId: string): StoredSession | null => {
  const session = getSessionHistory().find((item) => item.id === sessionId)
  return session || null
}

export const appendSessionHistoryEntry = ({
  question,
  answer,
  tags = [],
  company,
  role,
  notes,
  workspace
}: {
  question: string
  answer: string
  tags?: string[]
  company?: string
  role?: string
  notes?: string
  workspace?: SessionWorkspaceSnapshot
}): StoredSession => {
  const timestamp = Date.now()
  const snippet: StoredSnippet = {
    id: randomId("snippet"),
    question,
    answer,
    timestamp,
    tags,
    workspace
  }

  const newSession: StoredSession = {
    id: randomId("session"),
    date: timestamp,
    company,
    role,
    snippets: [snippet],
    notes
  }

  const current = getSessionHistory()
  const next = [newSession, ...current].slice(0, MAX_SESSION_HISTORY)
  store.set("sessionHistory", next)
  return newSession
}

export const deleteSessionHistoryItem = (sessionId: string): boolean => {
  const current = getSessionHistory()
  const next = current.filter((session) => session.id !== sessionId)
  if (next.length === current.length) {
    return false
  }
  store.set("sessionHistory", next)
  return true
}

export const clearSessionHistory = () => {
  store.set("sessionHistory", [])
}

export const clearStoreData = () => {
  store.clear()
}

export { store }

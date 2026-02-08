import Store from "electron-store"

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

const MAX_SESSION_HISTORY = 30

const store = new Store<StoreSchema>({
  name: 'session-history',
  defaults: {
    sessionHistory: []
  }
}) as Store<StoreSchema> & {
  store: StoreSchema
  get: <K extends keyof StoreSchema>(key: K) => StoreSchema[K]
  set: <K extends keyof StoreSchema>(key: K, value: StoreSchema[K]) => void
}

const randomId = (prefix: string) =>
  `${prefix}_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`

const normalizeHistory = (value: unknown): StoredSession[] => {
  if (!Array.isArray(value)) {
    return []
  }
  return value as StoredSession[]
}

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

export { store }

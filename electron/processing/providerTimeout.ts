export class ProviderTimeoutError extends Error {
  public readonly timeoutMs: number
  public readonly stage: string

  constructor(stage: string, timeoutMs: number) {
    super(`AI provider timed out while ${stage}.`)
    this.name = "ProviderTimeoutError"
    this.timeoutMs = timeoutMs
    this.stage = stage
  }
}

export interface RunWithProviderTimeoutOptions {
  signal: AbortSignal
  stage: string
  timeoutMs: number
  onTimeout?: () => void
}

export const isProviderTimeoutError = (
  error: unknown
): error is ProviderTimeoutError => error instanceof ProviderTimeoutError

const parseProviderTimeoutMs = (value: string | undefined): number | null => {
  if (!value) {
    return null
  }
  const parsed = Number(value)
  if (!Number.isFinite(parsed) || parsed <= 0) {
    return null
  }
  return Math.floor(parsed)
}

export const getProviderTimeoutMs = (): number => {
  const fromEnv = parseProviderTimeoutMs(process.env.PROCESSING_PROVIDER_TIMEOUT_MS)
  if (fromEnv !== null) {
    return fromEnv
  }
  return 60000
}

export const runWithProviderTimeout = async <T>(
  operation: () => Promise<T>,
  options: RunWithProviderTimeoutOptions
): Promise<T> => {
  const { signal, stage, timeoutMs, onTimeout } = options

  if (signal.aborted) {
    throw new Error("Processing was canceled by the user.")
  }

  let timer: NodeJS.Timeout | null = null

  try {
    return await Promise.race([
      operation(),
      new Promise<T>((_resolve, reject) => {
        timer = setTimeout(() => {
          if (onTimeout) {
            onTimeout()
          }
          reject(new ProviderTimeoutError(stage, timeoutMs))
        }, timeoutMs)
      })
    ])
  } finally {
    if (timer) {
      clearTimeout(timer)
    }
  }
}

import log from "electron-log"

type LogArgs = unknown[]

const formatArgs = (args: LogArgs): unknown[] => {
  return args.map((arg) => (arg instanceof Error ? arg.stack || arg.message : arg))
}

export const logger = {
  info: (...args: LogArgs) => {
    log.info(...formatArgs(args))
  },
  warn: (...args: LogArgs) => {
    log.warn(...formatArgs(args))
  },
  error: (...args: LogArgs) => {
    log.error(...formatArgs(args))
  },
  debug: (...args: LogArgs) => {
    if (process.env.NODE_ENV === "development") {
      log.debug(...formatArgs(args))
    }
  }
}

export const createScopedLogger = (scope: string) => ({
  info: (...args: LogArgs) => logger.info(`[${scope}]`, ...args),
  warn: (...args: LogArgs) => logger.warn(`[${scope}]`, ...args),
  error: (...args: LogArgs) => logger.error(`[${scope}]`, ...args),
  debug: (...args: LogArgs) => logger.debug(`[${scope}]`, ...args)
})

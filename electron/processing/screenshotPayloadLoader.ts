import fs from "node:fs"
import { logger } from "../logger"

export interface Base64ScreenshotPayload {
  path: string
  data: string
}

export const filterExistingScreenshotPaths = async (
  paths: string[]
): Promise<string[]> => {
  const results = await Promise.all(
    paths.map(async (p) => {
      try {
        await fs.promises.access(p)
        return p
      } catch {
        return null
      }
    })
  )
  return results.filter((p): p is string => p !== null)
}

export const loadScreenshotPayloads = async (
  paths: string[]
): Promise<Base64ScreenshotPayload[]> => {
  const loaded = await Promise.all(
    paths.map(async (path) => {
      try {
        const data = await fs.promises.readFile(path)
        return {
          path,
          data: data.toString("base64")
        }
      } catch (error) {
        logger.error(`Error reading screenshot ${path}:`, error)
        return null
      }
    })
  )

  return loaded.filter(
    (item): item is Base64ScreenshotPayload => item !== null
  )
}

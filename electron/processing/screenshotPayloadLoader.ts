import fs from "node:fs"
import { logger } from "../logger"

export interface Base64ScreenshotPayload {
  path: string
  data: string
}

export const filterExistingScreenshotPaths = (paths: string[]): string[] => {
  return paths.filter((path) => fs.existsSync(path))
}

export const loadScreenshotPayloads = async (
  paths: string[]
): Promise<Base64ScreenshotPayload[]> => {
  const loaded = await Promise.all(
    paths.map(async (path) => {
      try {
        return {
          path,
          data: fs.readFileSync(path).toString("base64")
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

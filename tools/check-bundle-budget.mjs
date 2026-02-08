import fs from "node:fs"
import path from "node:path"

const DIST_ASSETS_DIR = path.resolve("dist", "assets")
const MAX_JS_KB = Number(process.env.BUNDLE_MAX_JS_KB || 300)
const MAX_CSS_KB = Number(process.env.BUNDLE_MAX_CSS_KB || 120)

const toKb = (bytes) => Number((bytes / 1024).toFixed(2))

if (!fs.existsSync(DIST_ASSETS_DIR)) {
  console.error(
    `Bundle budget check failed: missing directory ${DIST_ASSETS_DIR}. Run a production build first.`
  )
  process.exit(1)
}

const files = fs.readdirSync(DIST_ASSETS_DIR)
const violations = []

for (const file of files) {
  const fullPath = path.join(DIST_ASSETS_DIR, file)
  const stat = fs.statSync(fullPath)
  if (!stat.isFile()) {
    continue
  }

  if (file.endsWith(".js")) {
    const sizeKb = toKb(stat.size)
    if (sizeKb > MAX_JS_KB) {
      violations.push(`${file}: ${sizeKb}KB > ${MAX_JS_KB}KB (JS budget)`)
    }
  }

  if (file.endsWith(".css")) {
    const sizeKb = toKb(stat.size)
    if (sizeKb > MAX_CSS_KB) {
      violations.push(`${file}: ${sizeKb}KB > ${MAX_CSS_KB}KB (CSS budget)`)
    }
  }
}

if (violations.length > 0) {
  console.error("Bundle budget check failed.")
  for (const violation of violations) {
    console.error(` - ${violation}`)
  }
  process.exit(1)
}

console.log(
  `Bundle budget check passed (JS <= ${MAX_JS_KB}KB, CSS <= ${MAX_CSS_KB}KB).`
)

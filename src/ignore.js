import { isJunk } from "junk"
import path from "node:path"
import isBinary from "is-binary"

const IGNORED_FILES = new Set([
  ".gif",
  ".jpg",
  ".jpeg",
  ".png",
  ".tiff",
  ".tif",
  ".ico",
  ".svg",
  ".bmp",
  ".webp",
  ".heif",
  ".heic",
  ".mpeg",
  ".mp4",
  ".webm",
  ".mov",
  ".mkv",
  ".avi",
  ".wmv",
  ".mp3",
  ".wav",
  ".ogg",
  ".midi",
  ".mid",
  ".amr",
  ".zip",
  ".tar",
  ".gz",
  ".rar",
  ".7z",
  ".xz",
  ".bz2",
  ".iso",
  ".dmg",
  ".bin",
  ".exe",
  ".apk",
  ".torrent"
])
//lazy af
const partialStringsToIgnore = [
  "logs",
  "*.log",
  "npm-debug.log*",
  "yarn-debug.log*",
  "yarn-error.log*",
  "lerna-debug.log*",
  ".pnpm-debug.log*",
  "pids",
  "*.pid",
  "*.seed",
  "*.pid.lock",
  "jspm_packages/",
  ".npm",
  "package-lock.json",
  "yarn.lock",
  ".DS_Store",
  ".gitignore",
  ".gitattributes",
  ".gitmodules",
  ".gitkeep",
  ".npmignore",
  ".dockerignore",
  ".eslintignore",
  ".prettierignore",
  ".git",
  "node_modules",
  "bower_components",
  "vendor",
  ".Coderobot",
  ".coderobot",
  ".Codepilot",
  ".codepilot",
  ".glb"
]

const ignores = (filename) => {
  let returnedValue = false
  for (const partialString of partialStringsToIgnore) {
    if (filename.includes(partialString)) {
      returnedValue = true
      break
    }
  }
  if (isBinary(filename)) {
    returnedValue = true
  }
  if (filename.includes("node_modules")) {
    returnedValue = true
  }
  // Ignore binary files
  if (IGNORED_FILES.has(path.extname(filename))) {
    returnedValue = true
  }
  if (isJunk(filename)) {
    returnedValue = true
  }
  if (returnedValue) {
    console.warn(`ignoring: ${filename}`)
  }
  return returnedValue
}

export default ignores

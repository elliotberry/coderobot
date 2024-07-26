import { isJunk } from "junk"
import path from "node:path"
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
  ".git",
  "node_modules",
  "bower_components",
  "vendor",
  ".Coderobot",
  ".coderobot",
  ".Codepilot",
  ".codepilot"
]

const ignores = function (filename, documentType) {
  let returnedValue = false
  for (const partialString of partialStringsToIgnore) {
    if (filename.includes(partialString)) {
      returnedValue = true
      break
    }
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
  return returnedValue
}

export default ignores

import { isJunk } from "junk"
import path from "node:path"
const IGNORED_FILES = [
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
]
//lazy af
const partialStringsToIgnore = [
  ".git",
  "node_modules",
  "bower_components",
  "vendor",
  ".codepilot"
]

const ignores = function (filename, docType) {
  let returnedVal = false
  for (const partialString of partialStringsToIgnore) {
    if (filename.indexOf(partialString) !== -1) {
      returnedVal = true
      break
    }
  }

  if (filename.indexOf("node_modules") !== -1) {
    returnedVal = true
  }
  // Ignore binary files
  if (IGNORED_FILES.includes(path.extname(filename))) {
    returnedVal = true
  }
  if (isJunk(filename)) {
    return true
  }
  return returnedVal
}

export default ignores

import fs from "node:fs/promises"
import path from "node:path"

class FileFetcher {
  async fetch(uri, onDocument) {
    uri = path.resolve(uri)
    // Does path exist and is it a directory?
    let isDirectory
    try {
      const stat = await fs.stat(uri)
      isDirectory = stat.isDirectory()
    } catch {
      return true
    }

    // If directory, read all files and recurse
    if (isDirectory) {
      const files = await fs.readdir(uri)
      for (const file of files) {
        const filePath = path.join(uri, file)
        await this.fetch(filePath, onDocument)
      }
      return true
    } else {
      // Read file and call onDocument
      const text = await fs.readFile(uri, "utf8")

      let pathData = path.parse(uri)
      let extension = pathData.ext
      if (!extension) {
        extension = "none"
      }
      return await onDocument(uri, text, extension ? extension : undefined)
    }
  }
}

export default FileFetcher

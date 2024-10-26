import fs from "node:fs/promises"

export default class LocalIndex {
  constructor(folderPath, indexName = "index.json") {
    this._folderPath = folderPath
    this._indexName = indexName
    this._data = undefined
    this._update = undefined
  }

  get folderPath() {
    return this._folderPath
  }

  get indexName() {
    return this._indexName
  }

  async beginUpdate() {
    await this.loadIndexData()
    this._update = true
  }

  cancelUpdate() {
    this._update = undefined
  }

  async createIndex(config = { version: 1, deleteIfExists: false }) {
    const { deleteIfExists } = config
    const indexFolder = `${this._folderPath}/${this._indexName}`

    if (deleteIfExists) {
      try {
        await fs.rm(indexFolder, { recursive: true, force: true })
      } catch (err) {
        if (err.code !== "ENOENT") throw err
      }
    }

    await fs.mkdir(this._folderPath, { recursive: true })
    await fs.writeFile(
      `${this._folderPath}/${this._indexName}`,
      JSON.stringify({ version: config.version })
    )
  }

  async deleteIndex() {
    await fs.rm(this._folderPath, { recursive: true, force: true })
  }

  async deleteItem(id) {
    await this.loadIndexData()
    const indexData = this._data.filter((item) => item.id !== id)
    await this._saveIndexData(indexData)
  }

  async endUpdate() {
    await this._saveIndexData(this._data)
    this._update = undefined
  }

  async getIndexStats() {
    await this.loadIndexData()
    const stats = {
      itemCount: this._data.length,
      indexSize: JSON.stringify(this._data).length
    }
    return stats
  }

  async getItem(id) {
    await this.loadIndexData()
    return this._data.find((item) => item.id === id)
  }

  async insertItem(item) {
    await this.loadIndexData()
    console.log(this._data)
    if (this._data.some((existingItem) => existingItem.id === item.id)) {
      throw new Error("Item with the same ID already exists.")
    }
    this._data.push(item)
    await this.endUpdate()
    return item
  }

  async isIndexCreated() {
    try {
      await fs.access(`${this._folderPath}/${this._indexName}`)
      return true
    } catch {
      return false
    }
  }

  async listItems() {
    await this.loadIndexData()
    return [...this._data]
  }

  async listItemsByMetadata(filter) {
    await this.loadIndexData()
    return this._data.filter((item) =>
      Object.entries(filter).every(
        ([key, value]) => item.metadata[key] === value
      )
    )
  }

  async queryItems(vector, topK, filter) {
    await this.loadIndexData()
    const filteredItems =
      filter ? await this.listItemsByMetadata(filter) : this._data
    // Simulated similarity calculation (in real case, you would replace this with actual vector calculations)
    const similarities = filteredItems.map((item) => ({
      item,
      similarity: Math.random()
    }))
    return similarities
      .sort((a, b) => b.similarity - a.similarity)
      .slice(0, topK)
      .map((result) => ({ item: result.item, score: result.similarity }))
  }

  async upsertItem(item) {
    await this.loadIndexData()
    const existingIndex = this._data.findIndex(
      (existingItem) => existingItem.id === item.id
    )
    if (existingIndex >= 0) {
      this._data[existingIndex] = item
    } else {
      this._data.push(item)
    }
    await this.endUpdate()
    return item
  }

  async loadIndexData() {
    if (!this._data) {
      try {
        const data = await fs.readFile(
          `${this._folderPath}/${this._indexName}`,
          "utf-8"
        )
        this._data = JSON.parse(data)
      } catch (err) {
        console.log(err)
        if (err.code === "ENOENT") {
          this._data = []
        } else {
          throw err
        }
      }
    }
  }

  async _saveIndexData(data) {
    await fs.writeFile(
      `${this._folderPath}/${this._indexName}`,
      JSON.stringify(data, null, 2)
    )
  }
}

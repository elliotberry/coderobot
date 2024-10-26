import fs from "node:fs/promises";
import path from "node:path";

export default class LocalIndex {
  constructor(folderPath = "./", indexName = "index.json") {
    this._folderPath = folderPath;
    this._indexName = indexName;
    this._data = undefined;
    this.filePath = path.join(this._folderPath, this._indexName);
  }

  async _saveIndexData(data) {
    await fs.writeFile(this.filePath, JSON.stringify(data, null, 2));
  }

  async beginUpdate() {
    if (!this._update) {
      await this.loadIndexData();
      this._update = true;
    }
  }

  cancelUpdate() {
    this._update = undefined;
  }

  async createIndex(config = { deleteIfExists: false, version: 1 }) {
    const { deleteIfExists } = config;

    if (deleteIfExists) {
      try {
        await fs.rm(this.filePath, { force: true });
      } catch (error) {
        if (error.code !== "ENOENT") throw error;
      }
    }

    await fs.mkdir(this._folderPath, { recursive: true });
    await this._saveIndexData({ version: config.version, items: [] });
  }

  async deleteIndex() {
    await fs.rm(this._folderPath, { force: true, recursive: true });
  }

  async deleteItem(id) {
    await this.beginUpdate();
    this._data.items = this._data.items.filter((item) => item.id !== id);
    await this.endUpdate();
  }

  async endUpdate() {
    if (this._update) {
      await this._saveIndexData(this._data);
      this._update = undefined;
    }
  }

  async getIndexStats() {
    await this.loadIndexData();
    return {
      indexSize: JSON.stringify(this._data).length,
      itemCount: this._data.items.length
    };
  }

  async getItem(id) {
    await this.loadIndexData();
    return this._data.items.find((item) => item.id === id);
  }

  async insertItem(item) {
    await this.beginUpdate();
    if (this._data.items.some((existingItem) => existingItem.id === item.id)) {
      throw new Error("Item with the same ID already exists.");
    }
    this._data.items.push(item);
    await this.endUpdate();
    return item;
  }

  async isIndexCreated() {
    try {
      await fs.access(this.filePath);
      return true;
    } catch {
      return false;
    }
  }

  async listItems() {
    await this.loadIndexData();
    return [...this._data.items];
  }

  async listItemsByMetadata(filter) {
    await this.loadIndexData();
    return this._data.items.filter((item) =>
      Object.entries(filter).every(([key, value]) => item.metadata[key] === value)
    );
  }

  async loadIndexData() {
    if (!this._data) {
      try {
        const data = await fs.readFile(this.filePath, "utf8");
        this._data = JSON.parse(data);
      } catch (error) {
        if (error.code === "ENOENT") {
          this._data = { items: [] };
        } else {
          throw error;
        }
      }
    }
  }

  async queryItems(vector, topK, filter) {
    await this.loadIndexData();
    const filteredItems = filter ? await this.listItemsByMetadata(filter) : this._data.items;
    // Simulated similarity calculation (in real case, you would replace this with actual vector calculations)
    const similarities = filteredItems.map((item) => ({
      item,
      similarity: Math.random()
    }));
    return similarities
      .sort((a, b) => b.similarity - a.similarity)
      .slice(0, topK)
      .map((result) => ({ item: result.item, score: result.similarity }));
  }

  async upsertItem(item) {
    await this.beginUpdate();
    const existingIndex = this._data.items.findIndex((existingItem) => existingItem.id === item.id);
    if (existingIndex === -1) {
      this._data.items.push(item);
    } else {
      this._data.items[existingIndex] = item;
    }
    await this.endUpdate();
    return item;
  }

  get folderPath() {
    return this._folderPath;
  }

  get indexName() {
    return this._indexName;
  }
}

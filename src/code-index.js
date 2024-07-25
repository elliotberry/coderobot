import { LocalDocumentIndex, FileFetcher, OpenAIEmbeddings } from "vectra"
import * as fs from "fs/promises"
import * as path from "path"
import Colorize from "./colorize.js"
import ignore from "./ignore.js"

// LLM-REGION
/**
 * The current projects source code index.
 */
export class CodeIndex {
  /**
   * Creates a new 'CodeIndex' instance.
   * @param folderPath Optional. The path to the folder containing the index. Defaults to '.codepilot'.
   */
  constructor(folderPath = ".codepilot") {
    this._folderPath = folderPath
  }
  /**
   * Gets the current code index configuration.
   */
  get config() {
    return this._config
  }
  /**
   * Gets the path to the folder containing the index.
   */
  get folderPath() {
    return this._folderPath
  }
  /**
   * Gets the current OpenAI keys.
   */
  get keys() {
    return this._keys
  }
  // LLM-REGION
  /**
   * Adds sources and extensions to the index.
   * @param config The configuration containing the sources and extensions to add.
   */
  async add(config) {
    if (!(await this.isCreated())) {
      throw new Error(
        "Index has not been created yet. Please run `codepilot create` first."
      )
    }
    // Ensure config loaded
    const configPath = path.join(this.folderPath, "config.json")
    if (!this._config) {
      this._config = JSON.parse(await fs.readFile(configPath, "utf-8"))
    }
    // Clone config
    const newConfig = Object.assign({}, this._config)
    // Add sources
    if (Array.isArray(config.sources)) {
      config.sources.forEach((source) => {
        if (!newConfig.sources.includes(source)) {
          newConfig.sources.push(source)
        }
      })
    }
    // Add extensions
    if (Array.isArray(config.extensions)) {
      if (!newConfig.extensions) {
        newConfig.extensions = []
      }
      config.extensions.forEach((extension) => {
        if (!newConfig.extensions.includes(extension)) {
          newConfig.extensions.push(extension)
        }
      })
    }
    // Write config
    await fs.writeFile(configPath, JSON.stringify(newConfig))
    this._config = newConfig
  }
  // LLM-REGION
  /**
   * Creates a new code index.
   * @param keys OpenAI keys to use.
   * @param config Source code index configuration.
   */
  async create(keys, config) {
    // Delete folder if it exists
    if (
      await fs
        .stat(this.folderPath)
        .then(() => true)
        .catch(() => false)
    ) {
      await fs.rm(this.folderPath, { recursive: true })
    }
    // Create folder
    await fs.mkdir(this.folderPath)
    try {
      // Create config file
      await fs.writeFile(
        path.join(this.folderPath, "config.json"),
        JSON.stringify(config)
      )
      // Create keys file
      await fs.writeFile(
        path.join(this.folderPath, "vectra.keys"),
        JSON.stringify(keys)
      )
      // Create .gitignore file
      await fs.writeFile(
        path.join(this.folderPath, ".gitignore"),
        "vectra.keys"
      )
      this._config = config
      this._keys = keys
      // Create index
      const index = await this.load()
      await index.createIndex()
    } catch (err) {
      this._config = undefined
      this._keys = undefined
      await fs.rm(this.folderPath, { recursive: true })
      throw new Error(`Error creating index: ${err.toString()}`)
    }
  }
  // LLM-REGION
  /**
   * Deletes the current code index.
   */
  async delete() {
    await fs.rm(this.folderPath, { recursive: true })
    this._config = undefined
    this._keys = undefined
    this._index = undefined
  }
  // LLM-REGION
  /**
   * Returns whether a `vectra.keys` file exists for the index.
   */
  async hasKeys() {
    return await fs
      .stat(path.join(this.folderPath, "vectra.keys"))
      .then(() => true)
      .catch(() => false)
  }
  /**
   * Returns true if the index has been created.
   */
  async isCreated() {
    return await fs
      .stat(this.folderPath)
      .then(() => true)
      .catch(() => false)
  }
  // LLM-REGION
  /**
   * Loads the current code index.
   */
  async load() {
    if (!this._config) {
      const configPath = path.join(this.folderPath, "config.json")
      this._config = JSON.parse(await fs.readFile(configPath, "utf-8"))
    }
    if (!this._keys) {
      const keysPath = path.join(this.folderPath, "vectra.keys")
      this._keys = JSON.parse(await fs.readFile(keysPath, "utf-8"))
    }
    if (!this._index) {
      const folderPath = path.join(this.folderPath, "index")
      const embeddings = new OpenAIEmbeddings(
        Object.assign({ model: "text-embedding-ada-002" }, this._keys)
      )
      this._index = new LocalDocumentIndex({
        folderPath,
        embeddings
      })
    }
    return this._index
  }
  // LLM-REGION
  /**
   * Queries the code index.
   * @param query Text to query the index with.
   * @param options Optional. Options to use when querying the index.
   * @returns Found documents.
   */
  async query(query, options) {
    if (!(await this.isCreated())) {
      throw new Error(
        "Index has not been created yet. Please run `codepilot create` first."
      )
    }
    if (!(await this.hasKeys())) {
      throw new Error(
        "A local vectra.keys file couldn't be found. Please run `codepilot set --key <your OpenAI key>`."
      )
    }
    // Query document index
    const index = await this.load()
    return await index.queryDocuments(query, options)
  }
  // LLM-REGION
  /**
   * Rebuilds the code index.
   */
  async rebuild() {
    if (!(await this.isCreated())) {
      throw new Error(
        "Index has not been created yet. Please run `codepilot create` first."
      )
    }
    if (!(await this.hasKeys())) {
      throw new Error(
        "A local vectra.keys file couldn't be found. Please run `codepilot set --key <your OpenAI key>`."
      )
    }
    // Create fresh index
    const index = await this.load()
    if (await index.isCatalogCreated()) {
      await index.deleteIndex()
    }
    await index.createIndex()
    // Index files
    const fetcher = new FileFetcher()
    console.log(this._config.sources);
    for (const source of this._config.sources) {
      await fetcher.fetch(source, async (uri, text, docType) => {
        // Ignore binary files
       let shouldIgnore = ignore(uri, docType)
        if (shouldIgnore) {
          return true
        }
        else {
          console.log(Colorize.progress(`adding: ${uri}`))
       
        
        // Upsert document
        console.log(Colorize.progress(`adding: ${uri}`))
        await index.upsertDocument(uri, text, docType)
        return true 
      }
      })
    }
  }
  // LLM-REGION
  /**
   * Removes sources and extensions from the index.
   * @param config The configuration containing the sources and extensions to remove.
   */
  async remove(config) {
    var _a
    if (!(await this.isCreated())) {
      throw new Error(
        "Index has not been created yet. Please run `codepilot create` first."
      )
    }
    // Ensure config loaded
    const configPath = path.join(this.folderPath, "config.json")
    if (!this._config) {
      this._config = JSON.parse(await fs.readFile(configPath, "utf-8"))
    }
    // Clone config
    const newConfig = Object.assign({}, this._config)
    // Remove sources
    if (Array.isArray(config.sources)) {
      newConfig.sources = newConfig.sources.filter(
        (source) => !config.sources.includes(source)
      )
    }
    // Remove extensions
    if (Array.isArray(config.extensions)) {
      newConfig.extensions =
        (_a = newConfig.extensions) === null || _a === void 0 ?
          void 0
        : _a.filter((extension) => !config.extensions.includes(extension))
    }
    // Write config
    await fs.writeFile(configPath, JSON.stringify(newConfig))
    this._config = newConfig
  }
  // LLM-REGION
  /**
   * Updates the OpenAI keys for the index.
   * @param keys Keys to use.
   */
  async setKeys(keys) {
    if (!(await this.isCreated())) {
      throw new Error(
        "Index has not been created yet. Please run `codepilot create` first."
      )
    }
    // Overwrite keys file
    await fs.writeFile(
      path.join(this.folderPath, "vectra.keys"),
      JSON.stringify(keys)
    )
    this._keys = keys
  }
  /**
   * Updates the code index configuration.
   * @param config Settings to update.
   */
  async setConfig(config) {
    if (!(await this.isCreated())) {
      throw new Error(
        "Index has not been created yet. Please run `codepilot create` first."
      )
    }
    // Ensure config loaded
    const configPath = path.join(this.folderPath, "config.json")
    if (!this._config) {
      this._config = JSON.parse(await fs.readFile(configPath, "utf-8"))
    }
    // Clone config
    const newConfig = Object.assign({}, this._config)
    // Apply changes
    if (config.model !== undefined) {
      newConfig.model = config.model
    }
    if (config.max_input_tokens !== undefined) {
      newConfig.max_input_tokens = config.max_input_tokens
    }
    if (config.max_tokens !== undefined) {
      newConfig.max_tokens = config.max_tokens
    }
    if (config.temperature !== undefined) {
      newConfig.temperature = config.temperature
    }
    // Write config
    await fs.writeFile(configPath, JSON.stringify(newConfig))
    this._config = newConfig
  }
  // LLM-REGION
  /**
   * Adds a document to the index.
   * @param path Path to the document to add.
   */
  async upsertDocument(path) {
    if (!(await this.isCreated())) {
      throw new Error(
        "Index has not been created yet. Please run `codepilot create` first."
      )
    }
    if (!(await this.hasKeys())) {
      throw new Error(
        "A local vectra.keys file couldn't be found. Please run `codepilot set --key <your OpenAI key>`."
      )
    }
    // Ensure index is loaded
    const index = await this.load()
    // Fetch document
    const fetcher = new FileFetcher()
    await fetcher.fetch(path, async (uri, text, docType) => {
      // Upsert document
      await index.upsertDocument(uri, text, docType)
      return true
    })
  }
}

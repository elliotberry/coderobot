import fs from "node:fs/promises"
import path from "node:path"
import { FileFetcher, LocalDocumentIndex, OpenAIEmbeddings } from "vectra"

import Colorize from "./colorize.js"
import ignore from "./ignore.js"


const noIndexError = "Index has not been created yet. Please run `Coderobot create` first."

// LLM-REGION
/**
 * The current projects source code index.
 */
export class CodeIndex {
  /**
   * Creates a new 'CodeIndex' instance.
   * @param folderPath Optional. The path to the folder containing the index. Defaults to '.Coderobot'.
   */
  constructor(folderPath = ".Coderobot") {
    this._folderPath = folderPath
    this._configFile = path.join(this.folderPath, "config.json")
    this._vectraKeys = path.join(this.folderPath, "vectra.keys")
  }
  /**
   * Adds sources and extensions to the index.
   * @param config The configuration containing the sources and extensions to add.
   */
  async add(config) {
    if (!(await this.isCreated())) {
      throw new Error(
        noIndexError
      )
    }
    // Ensure config loaded
    const configPath = this._configFile
    if (!this._config) {
      this._config = JSON.parse(await fs.readFile(configPath, "utf8"))
    }
    // Clone config
    const newConfig = Object.assign({}, this._config)
    // Add sources
    if (Array.isArray(config.sources)) {
      for (const source of config.sources) {
        if (!newConfig.sources.includes(source)) {
          newConfig.sources.push(source)
        }
      }
    }
    // Add extensions
    if (Array.isArray(config.extensions)) {
      if (!newConfig.extensions) {
        newConfig.extensions = []
      }
      for (const extension of config.extensions) {
        if (!newConfig.extensions.includes(extension)) {
          newConfig.extensions.push(extension)
        }
      }
    }
    // Write config
    await fs.writeFile(configPath, JSON.stringify(newConfig))
    this._config = newConfig
  }
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
        this._configFile,
        JSON.stringify(config)
      )
      // Create keys file
      await fs.writeFile(
        this._vectraKeys,
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
    } catch (error) {
      this._config = undefined
      this._keys = undefined
      await fs.rm(this.folderPath, { recursive: true })
      throw new Error(`Error creating index: ${error.toString()}`)
    }
  }
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
  // LLM-REGION
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
      const configPath = this._configFile
      this._config = JSON.parse(await fs.readFile(configPath, "utf8"))
    }
    if (!this._keys) {
      const keysPath = this._vectraKeys
      this._keys = JSON.parse(await fs.readFile(keysPath, "utf8"))
    }
    if (!this._index) {
      const folderPath = path.join(this.folderPath, "index")
      const embeddings = new OpenAIEmbeddings(
        Object.assign({ model: "text-embedding-ada-002" }, this._keys)
      )
      this._index = new LocalDocumentIndex({
        embeddings,
        folderPath
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
        noIndexError
      )
    }
    if (!(await this.hasKeys())) {
      throw new Error(
        "A local vectra.keys file couldn't be found. Please run `Coderobot set --key <your OpenAI key>`."
      )
    }
    // Query document index
    const index = await this.load()
    return await index.queryDocuments(query, options)
  }
  /**
   * Rebuilds the code index.
   */
  async rebuild() {
    if (!(await this.isCreated())) {
      throw new Error(
        noIndexError
      )
    }
    if (!(await this.hasKeys())) {
      throw new Error(
        "A local vectra.keys file couldn't be found. Please run `Coderobot set --key <your OpenAI key>`."
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
      await fetcher.fetch(source, async (uri, text, documentType) => {
        // Ignore binary files
       let shouldIgnore = ignore(uri, documentType)
        if (shouldIgnore) {
          return true
        }
        else {
          console.log(Colorize.progress(`adding: ${uri}`))
       
        
        // Upsert document
        console.log(Colorize.progress(`adding: ${uri}`))
        await index.upsertDocument(uri, text, documentType)
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
        noIndexError
      )
    }
    // Ensure config loaded
    const configPath = this._configFile
    if (!this._config) {
      this._config = JSON.parse(await fs.readFile(configPath, "utf8"))
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
   * Updates the code index configuration.
   * @param config Settings to update.
   */
  async setConfig(config) {
    if (!(await this.isCreated())) {
      throw new Error(
        noIndexError
      )
    }
    // Ensure config loaded
    const configPath = this._configFile
    if (!this._config) {
      this._config = JSON.parse(await fs.readFile(configPath, "utf8"))
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
   * Updates the OpenAI keys for the index.
   * @param keys Keys to use.
   */
  async setKeys(keys) {
    if (!(await this.isCreated())) {
      throw new Error(
        noIndexError
      )
    }
    // Overwrite keys file
    await fs.writeFile(
      this._vectraKeys,
      JSON.stringify(keys)
    )
    this._keys = keys
  }
  // LLM-REGION
  /**
   * Adds a document to the index.
   * @param path Path to the document to add.
   */
  async upsertDocument(path) {
    if (!(await this.isCreated())) {
      throw new Error(
        "Index has not been created yet. Please run `Coderobot create` first."
      )
    }
    if (!(await this.hasKeys())) {
      throw new Error(
        "A local vectra.keys file couldn't be found. Please run `Coderobot set --key <your OpenAI key>`."
      )
    }
    // Ensure index is loaded
    const index = await this.load()
    // Fetch document
    const fetcher = new FileFetcher()
    await fetcher.fetch(path, async (uri, text, documentType) => {
      // Upsert document
      await index.upsertDocument(uri, text, documentType)
      return true
    })
  }
  // LLM-REGION
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
  // LLM-REGION
  /**
   * Gets the current OpenAI keys.
   */
  get keys() {
    return this._keys
  }
}

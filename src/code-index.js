import 'dotenv/config';
import { Spinner } from "@topcli/spinner"
import exists from "elliotisms/exists"
import { mkdir, readFile, rm, writeFile } from "node:fs/promises"
import path from "node:path"

import FileFetcher from './vektra/file-fetcher.js'
import LocalDocumentIndex from './vektra/local-document-index.js'
import OpenAIEmbeddings from './vektra/openai-embeddings.js'
import ignore from "./ignore.js"
const noIndexError =
  "Index has not been created yet. Please run `coderobot create` first."
let openaiKey = process.env.OPENAI_API_KEY;


// LLM-REGION
/**
 * The current projects source code index.
 */
export class CodeIndex {
  /**
   * Creates a new 'CodeIndex' instance.
   * @param folderPath Optional. The path to the folder containing the index. Defaults to '.coderobot'.
   */
  constructor(folderPath = "./.coderobot") {
    this._folderPath = folderPath
    this._configFile = path.join(this._folderPath, "config.json")
  }
  /**
   * Adds sources and extensions to the index.
   * @param config The configuration containing the sources and extensions to add.
   */
  async add(config) {
    if (!(await this.isCreated())) {
      throw new Error(noIndexError)
    }
    // Ensure config loaded
    const configPath = this._configFile
    if (!this._config) {
      this._config = JSON.parse(await readFile(configPath, "utf8"))
    }
    // Clone config
    const newConfig = { ...this._config}
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
    await writeFile(configPath, JSON.stringify(newConfig))
    this._config = newConfig
  }
  /**
   * Creates a new code index.
   * @param keys OpenAI keys to use.
   * @param config Source code index configuration.
   */
  async create(key, config) {
    // Delete folder if it exists
    if (await exists(this._folderPath)) {
      await rm(this._folderPath, { recursive: true })
    }
    // Create folder
    await mkdir(this._folderPath)
    try {
      // Create config file
      await writeFile(this._configFile, JSON.stringify(config))
   
      this._config = config

      const index = await this.load()
      await index.createIndex()
    } catch (error) {
      this._config = undefined

      await rm(this._folderPath, { recursive: true })
      throw new Error(`Error creating index: ${error.toString()}`)
    }
  }
  /**
   * Deletes the current code index.
   */
  async delete() {
    await rm(this._folderPath, { recursive: true })
    this._config = undefined
   // this._keys = undefined
    this._index = undefined
  }

 
  /**
   * Returns true if the index has been created.
   */
  async isCreated() {
    return await exists(this._folderPath)
  }
  /**
   * Loads the current code index.
   */
  async load() {
    if (!this._config) {
      let data = await this.readJSON(this._configFile)
      this._config = data
    }

    if (!this._index) {
      const folderPath = path.join(this._folderPath, "index")
   
      const embeddings = new OpenAIEmbeddings(
        {apiKey: openaiKey, model: "text-embedding-3-small"}
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
      throw new Error(noIndexError)
    }
  //())) {
  //    console.log("keys problem")
   // }
    // Query document index
    const index = await this.load()
    return await index.queryDocuments(query, options)
  }
  
  // LLM-REGION
  async readJSON(file) {
    try {
      let data = await readFile(file, "utf8")
      return JSON.parse(data)
    } catch (error) {
      throw new Error(`Error reading JSON file: ${error.toString()}`)
    }
  }

  /**
   * Rebuilds the code index.
   */

  async rebuild() {
    if (!(await this.isCreated())) {
      throw new Error(noIndexError)
    }

    const index = await this.load()
    if (await index.isCatalogCreated()) {
      await index.deleteIndex()
    }
    await index.createIndex()

    // Index files
    const fetcher = new FileFetcher()
    const spinner = new Spinner().start("Start working!")
    for await (const source of this._config.sources) {
      await fetcher.fetch(source, async (uri, text, documentType) => {
        // Ignore binary files
        let shouldIgnore = ignore(uri, documentType)
        if (shouldIgnore) {
          spinner.text = `Ignoring: ${uri}`
          return true
        } else {
          // Upsert document
          spinner.text = `adding: ${uri}`
          await index.upsertDocument(uri, text, documentType)
          return true
        }
      })
    }
    spinner.succeed(`All done`)
  }
  // LLM-REGION
  /**
   * Removes sources and extensions from the index.
   * @param config The configuration containing the sources and extensions to remove.
   */
  async remove(config) {
    let _a
    if (!(await this.isCreated())) {
      throw new Error(noIndexError)
    }
    // Ensure config loaded
    const configPath = this._configFile
    if (!this._config) {
      this._config = JSON.parse(await readFile(configPath, "utf8"))
    }
    // Clone config
    const newConfig = { ...this._config}
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
    await writeFile(configPath, JSON.stringify(newConfig))
    this._config = newConfig
  }
  // LLM-REGION
  /**
   * Updates the code index configuration.
   * @param config Settings to update.
   */
  async setConfig(config) {
    if (!(await this.isCreated())) {
      throw new Error(noIndexError)
    }
    // Ensure config loaded
    const configPath = this._configFile
    if (!this._config) {
      this._config = JSON.parse(await readFile(configPath, "utf8"))
    }
    // Clone config
    const newConfig = { ...this._config}
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
    await writeFile(configPath, JSON.stringify(newConfig))
    this._config = newConfig
  }
  // LLM-REGION
  /**
   * Updates the OpenAI keys for the index.
   * @param keys Keys to use.
   */
  async setKeys(keys) {
 //   if (!(await this.isCreated())) {
 //     throw new Error(noIndexError)
 //   }
    // Overwrite keys file
 //   await writeFile(this._vectraKeys, JSON.stringify(keys))
 //   this._keys = keys
  }
  // LLM-REGION
  /**
   * Adds a document to the index.
   * @param path Path to the document to add.
   */
  async upsertDocument(path) {
    if (!(await this.isCreated())) {
      throw new Error(
        "Index has not been created yet. Please run `coderobot create` first."
      )
    }
 //  if (!(await this.hasKeys())) {
  //    vectraKeysError()
  //  }
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
 // get keys() {
 //   return this._keys
 // }
}

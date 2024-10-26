import { nanoid } from "nanoid"
import fs from "node:fs/promises"
import path from "node:path"

import GPT3Tokenizer from "./GPT3-tokenizer.js"
import LocalDocumentResult from "./local-document-result.js"
import LocalDocument from "./local-document.js"
import LocalIndex from "./local-index.js"
import TextSplitter from "./text-splitter.js"

/**
 * Represents a local index of documents stored on disk.
 */
class LocalDocumentIndex extends LocalIndex {
  constructor(config) {
    super(config.folderPath)
    this._embeddings = config.embeddings
    this._chunkingConfig = {
      chunkOverlap: 0,
        chunkSize: 512,
        keepSeparators: true,
      ...config.chunkingConfig
    }
    this._tokenizer =
      config.tokenizer || this._chunkingConfig.tokenizer || new GPT3Tokenizer()
    this._chunkingConfig.tokenizer = this._tokenizer
    this._catalog = undefined
    this._newCatalog = undefined
  }

  async beginUpdate() {
    await super.beginUpdate()
    this._newCatalog = { ...this._catalog}
  }

  cancelUpdate() {
    super.cancelUpdate()
    this._newCatalog = undefined
  }

  async createIndex(config) {
    await super.createIndex(config)
    await this.loadIndexData()
  }

  async deleteDocument(uri) {
    const documentId = await this.getDocumentId(uri)
    if (!documentId) return

    await this.beginUpdate()
    try {
      const chunks = await this.listItemsByMetadata({ documentId })
      for (const chunk of chunks) {
        await this.deleteItem(chunk.id)
      }

      delete this._newCatalog.uriToId[uri]
      delete this._newCatalog.idToUri[documentId]
      this._newCatalog.count--

      await this.endUpdate()
    } catch (error) {
      this.cancelUpdate()
      throw new Error(`Error deleting document "${uri}": ${error.toString()}`)
    }

    try {
      await fs.unlink(path.join(this.folderPath, `${documentId}.txt`))
    } catch (error) {
      throw new Error(
        `Error removing text file for document "${uri}" from disk: ${error.toString()}`
      )
    }

    try {
      await fs.unlink(path.join(this.folderPath, `${documentId}.json`))
    } catch {
      // Ignore error
    }
  }

  async endUpdate() {
    await super.endUpdate()

    try {
      await fs.writeFile(
        path.join(this.folderPath, "catalog.json"),
        JSON.stringify(this._newCatalog)
      )
      this._catalog = this._newCatalog
      this._newCatalog = undefined
    } catch (error) {
      throw new Error(`Error saving document catalog: ${error.toString()}`)
    }
  }

  async getCatalogStats() {
    const stats = await this.getIndexStats()
    return {
      chunks: stats.items,
      documents: this._catalog.count,
      metadata_config: stats.metadata_config,
      version: this._catalog.version
    }
  }

  async getDocumentId(uri) {
    await this.loadIndexData()
    return this._catalog?.uriToId[uri]
  }

  async getDocumentUri(documentId) {
    await this.loadIndexData()
    return this._catalog?.idToUri[documentId]
  }

  async isCatalogCreated() {
    try {
      await fs.access(path.join(this.folderPath, "catalog.json"))
      return true
    } catch {
      return false
    }
  }

  async listDocuments() {
    const docs = {}
    const chunks = await this.listItems()
    for (const chunk of chunks) {
      const metadata = chunk.metadata
      if (!docs[metadata.documentId]) {
        docs[metadata.documentId] = []
      }
      docs[metadata.documentId].push({ item: chunk, score: 1 })
    }

    const results = []
    for (const documentId in docs) {
      const uri = await this.getDocumentUri(documentId)
      const documentResult = new LocalDocumentResult(
        this,
        documentId,
        uri,
        docs[documentId],
        this._tokenizer
      )
      results.push(documentResult)
    }

    return results
  }

  async loadIndexData() {
    await super.loadIndexData()

    if (this._catalog) {
      return
    }

    const catalogPath = path.join(this.folderPath, "catalog.json")
    if (await this.isCatalogCreated()) {
      const buffer = await fs.readFile(catalogPath)
      this._catalog = JSON.parse(buffer.toString())
    } else {
      try {
        this._catalog = {
          count: 0,
          idToUri: {},
          uriToId: {},
          version: 1
        }
        await fs.writeFile(catalogPath, JSON.stringify(this._catalog))
      } catch (error) {
        throw new Error(`Error creating document catalog: ${error.toString()}`)
      }
    }
  }

  async queryDocuments(query, options = {}) {
    if (!this._embeddings) {
      throw new Error(`Embeddings model not configured.`)
    }

    options = {
      maxChunks: 50,
        maxDocuments: 10,
      ...options
    }

    let embeddings
    try {
      embeddings = await this._embeddings.createEmbeddings(
        query.replaceAll('\n', " ")
      )
    } catch (error) {
      throw new Error(
        `Error generating embeddings for query: ${error.toString()}`
      )
    }

    if (embeddings.status !== "success") {
      throw new Error(
        `Error generating embeddings for query: ${embeddings.message}`
      )
    }

    const results = await this.queryItems(
      embeddings.output[0],
      options.maxChunks,
      options.filter
    )

    const documentChunks = {}
    for (const result of results) {
      const metadata = result.item.metadata
      if (!documentChunks[metadata.documentId]) {
        documentChunks[metadata.documentId] = []
      }
      documentChunks[metadata.documentId].push(result)
    }

    const documentResults = []
    for (const documentId in documentChunks) {
      const chunks = documentChunks[documentId]
      const uri = await this.getDocumentUri(documentId)
      const documentResult = new LocalDocumentResult(
        this,
        documentId,
        uri,
        chunks,
        this._tokenizer
      )
      documentResults.push(documentResult)
    }

    return documentResults
      .sort((a, b) => b.score - a.score)
      .slice(0, options.maxDocuments)
  }

  async upsertDocument(uri, text, documentType, metadata) {
    if (!this._embeddings) {
      throw new Error(`Embeddings model not configured.`)
    }

    let documentId = await this.getDocumentId(uri)
    if (documentId) {
      await this.deleteDocument(uri)
    } else {
      documentId = nanoid()
    }

    const config = {docType: documentType, ...this._chunkingConfig}
    if (!config.docType) {
      const pos = uri.lastIndexOf(".")
      if (pos !== -1) {
        const extension = uri.slice(Math.max(0, pos + 1)).toLowerCase()
        config.docType = extension
      }
    }

    const splitter = new TextSplitter(config)
    const chunks = splitter.split(text)

    let totalTokens = 0
    const chunkBatches = []
    let currentBatch = []
    for (const chunk of chunks) {
      totalTokens += chunk.tokens.length
      if (totalTokens > this._embeddings.maxTokens) {
        chunkBatches.push(currentBatch)
        currentBatch = []
        totalTokens = chunk.tokens.length
      }
      currentBatch.push(chunk.text.replaceAll('\n', " "))
    }
    if (currentBatch.length > 0) {
      chunkBatches.push(currentBatch)
    }

    const embeddings = []
    for (const batch of chunkBatches) {
      let response
      try {
        response = await this._embeddings.createEmbeddings(batch)
      } catch (error) {
        throw new Error(`Error generating embeddings: ${error.toString()}`)
      }

      if (response.status !== "success") {
        throw new Error(`Error generating embeddings: ${response.message}`)
      }

      for (const embedding of response.output) {
        embeddings.push(embedding)
      }
    }

    await this.beginUpdate()
    try {
      let index = 0
      for await (let chunk of chunks) {
        const embedding = embeddings[index]
        const chunkMetadata = {
          documentId,
            endPos: chunk.endPos,
            startPos: chunk.startPos,
          ...metadata
        }
        await this.insertItem({
          id: nanoid(),
          metadata: chunkMetadata,
          vector: embedding
        })
        index++
      }

      if (metadata != undefined) {
        await fs.writeFile(
          path.join(this.folderPath, `${documentId}.json`),
          JSON.stringify(metadata)
        )
      }

      await fs.writeFile(path.join(this.folderPath, `${documentId}.txt`), text)

      this._newCatalog.uriToId[uri] = documentId
      this._newCatalog.idToUri[documentId] = uri
      this._newCatalog.count++

      await this.endUpdate()
    } catch (error) {
      this.cancelUpdate()
      throw new Error(`Error adding document "${uri}": ${error.toString()}`)
    }

    return new LocalDocument(this, documentId, uri)
  }

  get embeddings() {
    return this._embeddings
  }

  get tokenizer() {
    return this._tokenizer
  }
}

export default LocalDocumentIndex

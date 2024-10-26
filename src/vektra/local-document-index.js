import fs from 'node:fs/promises';
import path from "node:path"
import {nanoid} from 'nanoid';
import GPT3Tokenizer from './GPT3-tokenizer.js';
import LocalIndex from './local-index.js';
import TextSplitter from './text-splitter.js';


import LocalDocumentResult from './local-document-result.js';
import LocalDocument from './local-document.js';

/**
 * Represents a local index of documents stored on disk.
 */
class LocalDocumentIndex extends LocalIndex {
    constructor(config) {
        super(config.folderPath);
        this._embeddings = config.embeddings;
        this._chunkingConfig = Object.assign({
            keepSeparators: true,
            chunkSize: 512,
            chunkOverlap: 0,
        }, config.chunkingConfig);
        this._tokenizer = config.tokenizer || this._chunkingConfig.tokenizer || new GPT3Tokenizer();
        this._chunkingConfig.tokenizer = this._tokenizer;
        this._catalog = undefined;
        this._newCatalog = undefined;
    }

    get embeddings() {
        return this._embeddings;
    }

    get tokenizer() {
        return this._tokenizer;
    }

    async isCatalogCreated() {
        try {
            await fs.access(path.join(this.folderPath, 'catalog.json'));
            return true;
        } catch (err) {
            return false;
        }
    }

    async getDocumentId(uri) {
        await this.loadIndexData();
        return this._catalog?.uriToId[uri];
    }

    async getDocumentUri(documentId) {
        await this.loadIndexData();
        return this._catalog?.idToUri[documentId];
    }

    async getCatalogStats() {
        const stats = await this.getIndexStats();
        return {
            version: this._catalog.version,
            documents: this._catalog.count,
            chunks: stats.items,
            metadata_config: stats.metadata_config
        };
    }

    async deleteDocument(uri) {
        const documentId = await this.getDocumentId(uri);
        if (!documentId) return;

        await this.beginUpdate();
        try {
            const chunks = await this.listItemsByMetadata({ documentId });
            for (const chunk of chunks) {
                await this.deleteItem(chunk.id);
            }

            delete this._newCatalog.uriToId[uri];
            delete this._newCatalog.idToUri[documentId];
            this._newCatalog.count--;

            await this.endUpdate();
        } catch (err) {
            this.cancelUpdate();
            throw new Error(`Error deleting document "${uri}": ${err.toString()}`);
        }

        try {
            await fs.unlink(path.join(this.folderPath, `${documentId}.txt`));
        } catch (err) {
            throw new Error(`Error removing text file for document "${uri}" from disk: ${err.toString()}`);
        }

        try {
            await fs.unlink(path.join(this.folderPath, `${documentId}.json`));
        } catch (err) {
            // Ignore error
        }
    }

    async upsertDocument(uri, text, docType, metadata) {
        if (!this._embeddings) {
            throw new Error(`Embeddings model not configured.`);
        }

        let documentId = await this.getDocumentId(uri);
        if (documentId) {
            await this.deleteDocument(uri);
        } else {
            documentId = nanoid();
        }

        const config = Object.assign({ docType }, this._chunkingConfig);
        if (!config.docType) {
            const pos = uri.lastIndexOf('.');
            if (pos >= 0) {
                const ext = uri.substring(pos + 1).toLowerCase();
                config.docType = ext;
            }
        }

        const splitter = new TextSplitter(config);
        const chunks = splitter.split(text);

        let totalTokens = 0;
        const chunkBatches = [];
        let currentBatch = [];
        for (const chunk of chunks) {
            totalTokens += chunk.tokens.length;
            if (totalTokens > this._embeddings.maxTokens) {
                chunkBatches.push(currentBatch);
                currentBatch = [];
                totalTokens = chunk.tokens.length;
            }
            currentBatch.push(chunk.text.replace(/\n/g, ' '));
        }
        if (currentBatch.length > 0) {
            chunkBatches.push(currentBatch);
        }

        const embeddings = [];
        for (const batch of chunkBatches) {
            let response;
            try {
                response = await this._embeddings.createEmbeddings(batch);
            } catch (err) {
                throw new Error(`Error generating embeddings: ${err.toString()}`);
            }

            if (response.status !== 'success') {
                throw new Error(`Error generating embeddings: ${response.message}`);
            }

            for (const embedding of response.output) {
                embeddings.push(embedding);
            }
        }

        await this.beginUpdate();
        try {
            let iterator = Array.from(chunks)
            for await (chunk of iterator) {
            
                const embedding = embeddings[i];
                const chunkMetadata = Object.assign({
                    documentId,
                    startPos: chunk.startPos,
                    endPos: chunk.endPos,
                }, metadata);
                await this.insertItem({
                    id: nanoid(),
                    metadata: chunkMetadata,
                    vector: embedding,
                });
            }

            if (metadata != undefined) {
                await fs.writeFile(path.join(this.folderPath, `${documentId}.json`), JSON.stringify(metadata));
            }

            await fs.writeFile(path.join(this.folderPath, `${documentId}.txt`), text);

            this._newCatalog.uriToId[uri] = documentId;
            this._newCatalog.idToUri[documentId] = uri;
            this._newCatalog.count++;

            await this.endUpdate();
        } catch (err) {
            this.cancelUpdate();
            throw new Error(`Error adding document "${uri}": ${err.toString()}`);
        }

        return new LocalDocument(this, documentId, uri);
    }

    async listDocuments() {
        const docs = {};
        const chunks = await this.listItems();
        chunks.forEach(chunk => {
            const metadata = chunk.metadata;
            if (!docs[metadata.documentId]) {
                docs[metadata.documentId] = [];
            }
            docs[metadata.documentId].push({ item: chunk, score: 1.0 });
        });

        const results = [];
        for (const documentId in docs) {
            const uri = await this.getDocumentUri(documentId);
            const documentResult = new LocalDocumentResult(this, documentId, uri, docs[documentId], this._tokenizer);
            results.push(documentResult);
        }

        return results;
    }

    async queryDocuments(query, options = {}) {
        if (!this._embeddings) {
            throw new Error(`Embeddings model not configured.`);
        }

        options = Object.assign({
            maxDocuments: 10,
            maxChunks: 50,
        }, options);

        let embeddings;
        try {
            embeddings = await this._embeddings.createEmbeddings(query.replace(/\n/g, ' '));
        } catch (err) {
            throw new Error(`Error generating embeddings for query: ${err.toString()}`);
        }

        if (embeddings.status !== 'success') {
            throw new Error(`Error generating embeddings for query: ${embeddings.message}`);
        }

        const results = await this.queryItems(embeddings.output[0], options.maxChunks, options.filter);

        const documentChunks = {};
        for (const result of results) {
            const metadata = result.item.metadata;
            if (!documentChunks[metadata.documentId]) {
                documentChunks[metadata.documentId] = [];
            }
            documentChunks[metadata.documentId].push(result);
        }

        const documentResults = [];
        for (const documentId in documentChunks) {
            const chunks = documentChunks[documentId];
            const uri = await this.getDocumentUri(documentId);
            const documentResult = new LocalDocumentResult(this, documentId, uri, chunks, this._tokenizer);
            documentResults.push(documentResult);
        }

        return documentResults.sort((a, b) => b.score - a.score).slice(0, options.maxDocuments);
    }

    async beginUpdate() {
        await super.beginUpdate();
        this._newCatalog = Object.assign({}, this._catalog);
    }

    cancelUpdate() {
        super.cancelUpdate();
        this._newCatalog = undefined;
    }

    async createIndex(config) {
        await super.createIndex(config);
        await this.loadIndexData();
    }

    async endUpdate() {
        await super.endUpdate();

        try {
            await fs.writeFile(path.join(this.folderPath, 'catalog.json'), JSON.stringify(this._newCatalog));
            this._catalog = this._newCatalog;
            this._newCatalog = undefined;
        } catch (err) {
            throw new Error(`Error saving document catalog: ${err.toString()}`);
        }
    }

    async loadIndexData() {
        await super.loadIndexData();

        if (this._catalog) {
            return;
        }

        const catalogPath = path.join(this.folderPath, 'catalog.json');
        if (await this.isCatalogCreated()) {
            const buffer = await fs.readFile(catalogPath);
            this._catalog = JSON.parse(buffer.toString());
        } else {
            try {
                this._catalog = {
                    version: 1,
                    count: 0,
                    uriToId: {},
                    idToUri: {},
                };
                await fs.writeFile(catalogPath, JSON.stringify(this._catalog));
            } catch (err) {
                throw new Error(`Error creating document catalog: ${err.toString()}`);
            }
        }
    }
}

export default LocalDocumentIndex

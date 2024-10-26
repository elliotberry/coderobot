import fs from 'fs/promises';
import path from 'node:path';


/**
 * Represents an indexed document stored on disk.
 */
class LocalDocument {
    constructor(index, id, uri) {
        this._index = index;
        this._id = id;
        this._uri = uri;
        this._metadata = undefined;
        this._text = undefined;
    }

    /**
     * Returns the length of the document in tokens.
     * @remarks
     * This value will be estimated for documents longer than 40k bytes.
     * @returns Length of the document in tokens.
     */
    async getLength() {
        const text = await this.loadText();
        return text.length <= 40_000 ? this._index.tokenizer.encode(text).length : Math.ceil(text.length / 4);
    }

    /**
     * Determines if the document has additional metadata stored on disk.
     * @returns True if the document has metadata; otherwise, false.
     */
    async hasMetadata() {
        try {
            await fs.access(path.join(this.folderPath, `${this.id}.json`));
            return true;
        } catch {
            return false;
        }
    }

    /**
     * Loads the metadata for the document from disk.
     * @returns Metadata for the document.
     */
    async loadMetadata() {
        if (this._metadata == undefined) {
            let json;
            try {
                json = (await fs.readFile(path.join(this.folderPath, `${this.id}.json`))).toString();
            } catch (error) {
                throw new Error(`Error reading metadata for document "${this.uri}": ${error.toString()}`);
            }

            try {
                this._metadata = JSON.parse(json);
            } catch (error) {
                throw new Error(`Error parsing metadata for document "${this.uri}": ${error.toString()}`);
            }
        }

        return this._metadata;
    }

    /**
     * Loads the text for the document from disk.
     * @returns Text for the document.
     */
    async loadText() {
        if (this._text == undefined) {
            try {
                this._text = (await fs.readFile(path.join(this.folderPath, `${this.id}.txt`))).toString();
            } catch (error) {
                throw new Error(`Error reading text file for document "${this.uri}": ${error.toString()}`);
            }
        }

        return this._text;
    }

    /**
     * Returns the folder path where the document is stored.
     */
    get folderPath() {
        return this._index.folderPath;
    }

    /**
     * Returns the ID of the document.
     */
    get id() {
        return this._id;
    }

    /**
     * Returns the URI of the document.
     */
    get uri() {
        return this._uri;
    }
}

export default LocalDocument

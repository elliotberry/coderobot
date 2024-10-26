import GPT3Tokenizer from "./GPT3-tokenizer.js"


const ALPHANUMERIC_CHARS = 'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';

class TextSplitter {
    constructor(config = {}) {
        this._config = Object.assign({
            keepSeparators: false,
            chunkSize: 400,
            chunkOverlap: 40,
        }, config);

        // Create a default tokenizer if none is provided
        if (!this._config.tokenizer) {
            this._config.tokenizer = new GPT3Tokenizer();
        }

        // Use default separators if none are provided
        if (!this._config.separators || this._config.separators.length === 0) {
            this._config.separators = this.getSeparators(this._config.docType);
        }

        // Validate the config settings
        if (this._config.chunkSize < 1) {
            throw new Error("chunkSize must be >= 1");
        } else if (this._config.chunkOverlap < 0) {
            throw new Error("chunkOverlap must be >= 0");
        } else if (this._config.chunkOverlap > this._config.chunkSize) {
            throw new Error("chunkOverlap must be <= chunkSize");
        }
    }

    split(text) {
        const chunks = this.recursiveSplit(text, this._config.separators, 0);

        const that = this;
        function getOverlapTokens(tokens) {
            if (tokens != undefined) {
                const len = tokens.length > that._config.chunkOverlap ? that._config.chunkOverlap : tokens.length;
                return tokens.slice(0, len);
            } else {
                return [];
            }
        }

        // Add overlap tokens and text to the start and end of each chunk
        if (this._config.chunkOverlap > 0) {
            for (let i = 1; i < chunks.length; i++) {
                const previousChunk = chunks[i - 1];
                const chunk = chunks[i];
                const nextChunk = i < chunks.length - 1 ? chunks[i + 1] : undefined;
                chunk.startOverlap = getOverlapTokens(previousChunk.tokens.reverse()).reverse();
                chunk.endOverlap = getOverlapTokens(nextChunk?.tokens);
            }
        }

        return chunks;
    }

    recursiveSplit(text, separators, startPos) {
        const chunks = [];
        if (text.length > 0) {
            let parts;
            let separator = '';
            const nextSeparators = separators.length > 1 ? separators.slice(1) : [];
            if (separators.length > 0) {
                separator = separators[0];
                parts = separator == ' ' ? this.splitBySpaces(text) : text.split(separator);
            } else {
                const half = Math.floor(text.length / 2);
                parts = [text.substring(0, half), text.substring(half)];
            }

            for (let i = 0; i < parts.length; i++) {
                const lastChunk = (i === parts.length - 1);
                let chunk = parts[i];
                const endPos = (startPos + (chunk.length - 1)) + (lastChunk ? 0 : separator.length);
                if (this._config.keepSeparators && !lastChunk) {
                    chunk += separator;
                }

                if (!this.containsAlphanumeric(chunk)) {
                    continue;
                }

                if (chunk.length / 6 > this._config.chunkSize) {
                    const subChunks = this.recursiveSplit(chunk, nextSeparators, startPos);
                    chunks.push(...subChunks);
                } else {
                    const tokens = this._config.tokenizer.encode(chunk);
                    if (tokens.length > this._config.chunkSize) {
                        const subChunks = this.recursiveSplit(chunk, nextSeparators, startPos);
                        chunks.push(...subChunks);
                    } else {
                        chunks.push({
                            text: chunk,
                            tokens: tokens,
                            startPos: startPos,
                            endPos: endPos,
                            startOverlap: [],
                            endOverlap: [],
                        });
                    }
                }

                startPos = endPos + 1;
            }
        }

        return this.combineChunks(chunks);
    }

    combineChunks(chunks) {
        const combinedChunks = [];
        let currentChunk;
        let currentLength = 0;
        const separator = this._config.keepSeparators ? '' : ' ';
        for (let i = 0; i < chunks.length; i++) {
            const chunk = chunks[i];
            if (currentChunk) {
                const length = currentChunk.tokens.length + chunk.tokens.length;
                if (length > this._config.chunkSize) {
                    combinedChunks.push(currentChunk);
                    currentChunk = chunk;
                    currentLength = chunk.tokens.length;
                } else {
                    currentChunk.text += separator + chunk.text;
                    currentChunk.endPos = chunk.endPos;
                    currentChunk.tokens.push(...chunk.tokens);
                    currentLength += chunk.tokens.length;
                }
            } else {
                currentChunk = chunk;
                currentLength = chunk.tokens.length;
            }
        }
        if (currentChunk) {
            combinedChunks.push(currentChunk);
        }
        return combinedChunks;
    }

    containsAlphanumeric(text) {
        for (let i = 0; i < text.length; i++) {
            if (ALPHANUMERIC_CHARS.includes(text[i])) {
                return true;
            }
        }
        return false;
    }

    splitBySpaces(text) {
        const parts = [];
        let tokens = this._config.tokenizer.encode(text);
        do {
            if (tokens.length <= this._config.chunkSize) {
                parts.push(this._config.tokenizer.decode(tokens));
                break;
            } else {
                const span = tokens.splice(0, this._config.chunkSize);
                parts.push(this._config.tokenizer.decode(span));
            }
        } while (true);

        return parts;
    }

    getSeparators(docType) {
        switch (docType ?? '') {
            case "cpp":
                return [
                    "\nclass ",
                    "\nvoid ",
                    "\nint ",
                    "\nfloat ",
                    "\ndouble ",
                    "\nif ",
                    "\nfor ",
                    "\nwhile ",
                    "\nswitch ",
                    "\ncase ",
                    "\n\n",
                    "\n",
                    " "
                ];
            case "go":
                return [
                    "\nfunc ",
                    "\nvar ",
                    "\nconst ",
                    "\ntype ",
                    "\nif ",
                    "\nfor ",
                    "\nswitch ",
                    "\ncase ",
                    "\n\n",
                    "\n",
                    " "
                ];
            case "java":
            case "c#":
            case "csharp":
            case "cs":
            case "ts":
            case "tsx":
            case "typescript":
                return [
                    "// LLM-REGION",
                    "/* LLM-REGION",
                    "/** LLM-REGION",
                    "\nclass ",
                    "\npublic ",
                    "\nprotected ",
                    "\nprivate ",
                    "\nstatic ",
                    "\nif ",
                    "\nfor ",
                    "\nwhile ",
                    "\nswitch ",
                    "\ncase ",
                    "\n\n",
                    "\n",
                    " "
                ];
            case "js":
            case "jsx":
            case "javascript":
                return [
                    "// LLM-REGION",
                    "/* LLM-REGION",
                    "/** LLM-REGION",
                    "\nclass ",
                    "\nfunction ",
                    "\nconst ",
                    "\nlet ",
                    "\nvar ",
                    "\nclass ",
                    "\nif ",
                    "\nfor ",
                    "\nwhile ",
                    "\nswitch ",
                    "\ncase ",
                    "\ndefault ",
                    "\n\n",
                    "\n",
                    " "
                ];
            case "php":
                return [
                    "\nfunction ",
                    "\nclass ",
                    "\nif ",
                    "\nforeach ",
                    "\nwhile ",
                    "\ndo ",
                    "\nswitch ",
                    "\ncase ",
                    "\n\n",
                    "\n",
                    " "
                ];
            case "proto":
                return [
                    "\nmessage ",
                    "\nservice ",
                    "\nenum ",
                    "\noption ",
                    "\nimport ",
                    "\nsyntax ",
                    "\n\n",
                    "\n",
                    " "
                ];
            case "python":
            case "py":
                return [
                    "\nclass ",
                    "\ndef ",
                    "\n\tdef ",
                    "\n\n",
                    "\n",
                    " "
                ];
            case "rst":
                return [
                    "\n===\n",
                    "\n---\n",
                    "\n***\n",
                    "\n.. ",
                    "\n\n",
                    "\n",
                    " "
                ];
            case "ruby":
                return [
                    "\ndef ",
                    "\nclass ",
                    "\nif ",
                    "\nunless ",
                    "\nwhile ",
                    "\nfor ",
                    "\ndo ",
                    "\nbegin ",
                    "\nrescue ",
                    "\n\n",
                    "\n",
                    " "
                ];
            case "rust":
                return [
                    "\nfn ",
                    "\nconst ",
                    "\nlet ",
                    "\nif ",
                    "\nwhile ",
                    "\nfor ",
                    "\nloop ",
                    "\nmatch ",
                    "\nconst ",
                    "\n\n",
                    "\n",
                    " "
                ];
            case "scala":
                return [
                    "\nclass ",
                    "\nobject ",
                    "\ndef ",
                    "\nval ",
                    "\nvar ",
                    "\nif ",
                    "\nfor ",
                    "\nwhile ",
                    "\nmatch ",
                    "\ncase ",
                    "\n\n",
                    "\n",
                    " "
                ];
            case "swift":
                return [
                    "\nfunc ",
                    "\nclass ",
                    "\nstruct ",
                    "\nenum ",
                    "\nif ",
                    "\nfor ",
                    "\nwhile ",
                    "\ndo ",
                    "\nswitch ",
                    "\ncase ",
                    "\n\n",
                    "\n",
                    " "
                ];
            case "md":
            case "markdown":
                return [
                    "\n## ",
                    "\n### ",
                    "\n#### ",
                    "\n##### ",
                    "\n###### ",
                    "```\n\n",
                    "\n\n***\n\n",
                    "\n\n---\n\n",
                    "\n\n___\n\n",
                    "<table>",
                    "\n\n",
                    "\n",
                    " "
                ];
            case "latex":
                return [
                    "\n\chapter{",
                    "\n\section{",
                    "\n\subsection{",
                    "\n\subsubsection{",
                    "\n\begin{enumerate}",
                    "\n\begin{itemize}",
                    "\n\begin{description}",
                    "\n\begin{list}",
                    "\n\begin{quote}",
                    "\n\begin{quotation}",
                    "\n\begin{verse}",
                    "\n\begin{verbatim}",
                    "\n\begin{align}",
                    "$$",
                    "$",
                    "\n\n",
                    "\n",
                    " "
                ];
            case "html":
                return [
                    "<body>",
                    "<div>",
                    "<p>",
                    "<br>",
                    "<li>",
                    "<h1>",
                    "<h2>",
                    "<h3>",
                    "<h4>",
                    "<h5>",
                    "<h6>",
                    "<span>",
                    "<table>",
                    "<tr>",
                    "<td>",
                    "<th>",
                    "<ul>",
                    "<ol>",
                    "<header>",
                    "<footer>",
                    "<nav>",
                    "<head>",
                    "<style>",
                    "<script>",
                    "<meta>",
                    "<title>",
                    " "
                ];
            case "sol":
                return [
                    "\npragma ",
                    "\nusing ",
                    "\ncontract ",
                    "\ninterface ",
                    "\nlibrary ",
                    "\nconstructor ",
                    "\ntype ",
                    "\nfunction ",
                    "\nevent ",
                    "\nmodifier ",
                    "\nerror ",
                    "\nstruct ",
                    "\nenum ",
                    "\nif ",
                    "\nfor ",
                    "\nwhile ",
                    "\ndo while ",
                    "\nassembly ",
                    "\n\n",
                    "\n",
                    " "
                ];
            default:
                return [
                    "\n\n",
                    "\n",
                    " ",
                    "",
                ];
        }
    }
}

export default TextSplitter;

import GPT3Tokenizer from "./GPT3-tokenizer.js"

const ALPHANUMERIC_CHARS =
  "abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789"

class TextSplitter {
  constructor(config = {}) {
    this._config = {
      chunkOverlap: 40,
      chunkSize: 400,
      keepSeparators: false,
      ...config
    }

    // Create a default tokenizer if none is provided
    if (!this._config.tokenizer) {
      this._config.tokenizer = new GPT3Tokenizer()
    }

    // Use default separators if none are provided
    if (!this._config.separators || this._config.separators.length === 0) {
      this._config.separators = this.getSeparators(this._config.docType)
    }

    // Validate the config settings
    if (this._config.chunkSize < 1) {
      throw new Error("chunkSize must be >= 1")
    } else if (this._config.chunkOverlap < 0) {
      throw new Error("chunkOverlap must be >= 0")
    } else if (this._config.chunkOverlap > this._config.chunkSize) {
      throw new Error("chunkOverlap must be <= chunkSize")
    }
  }

  combineChunks(chunks) {
    const combinedChunks = []
    let currentChunk
    let currentLength = 0
    const separator = this._config.keepSeparators ? "" : " "
    for (const chunk of chunks) {
      if (currentChunk) {
        const length = currentChunk.tokens.length + chunk.tokens.length
        if (length > this._config.chunkSize) {
          combinedChunks.push(currentChunk)
          currentChunk = chunk
          currentLength = chunk.tokens.length
        } else {
          currentChunk.text += separator + chunk.text
          currentChunk.endPos = chunk.endPos
          currentChunk.tokens.push(...chunk.tokens)
          currentLength += chunk.tokens.length
        }
      } else {
        currentChunk = chunk
        currentLength = chunk.tokens.length
      }
    }
    if (currentChunk) {
      combinedChunks.push(currentChunk)
    }
    return combinedChunks
  }

  containsAlphanumeric(text) {
    for (const element of text) {
      if (ALPHANUMERIC_CHARS.includes(element)) {
        return true
      }
    }
    return false
  }

  getSeparators(documentType) {
    switch (documentType ?? "") {
      case "cpp": {
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
        ]
      }
      case "go": {
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
        ]
      }
      case "java":
      case "c#":
      case "csharp":
      case "cs":
      case "ts":
      case "tsx":
      case "typescript": {
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
        ]
      }
      case "js":
      case "jsx":
      case "javascript": {
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
        ]
      }
      case "php": {
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
        ]
      }
      case "proto": {
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
        ]
      }
      case "python":
      case "py": {
        return ["\nclass ", "\ndef ", "\n\tdef ", "\n\n", "\n", " "]
      }
      case "rst": {
        return ["\n===\n", "\n---\n", "\n***\n", "\n.. ", "\n\n", "\n", " "]
      }
      case "ruby": {
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
        ]
      }
      case "rust": {
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
        ]
      }
      case "scala": {
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
        ]
      }
      case "swift": {
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
        ]
      }
      case "md":
      case "markdown": {
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
        ]
      }
      case "latex": {
        return [
          "\nchapter{",
          "\nsection{",
          "\nsubsection{",
          "\nsubsubsection{",
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
        ]
      }
      case "html": {
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
        ]
      }
      case "sol": {
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
        ]
      }
      default: {
        return ["\n\n", "\n", " ", ""]
      }
    }
  }

  recursiveSplit(text, separators, startPos) {
    const chunks = []
    if (text.length > 0) {
      let parts
      let separator = ""
      const nextSeparators = separators.length > 1 ? separators.slice(1) : []
      if (separators.length > 0) {
        separator = separators[0]
        parts =
          separator == " " ? this.splitBySpaces(text) : text.split(separator)
      } else {
        const half = Math.floor(text.length / 2)
        parts = [
          text.slice(0, Math.max(0, half)),
          text.slice(Math.max(0, half))
        ]
      }

      for (let index = 0; index < parts.length; index++) {
        const lastChunk = index === parts.length - 1
        let chunk = parts[index]
        const endPos =
          startPos + (chunk.length - 1) + (lastChunk ? 0 : separator.length)
        if (this._config.keepSeparators && !lastChunk) {
          chunk += separator
        }

        if (!this.containsAlphanumeric(chunk)) {
          continue
        }

        if (chunk.length / 6 > this._config.chunkSize) {
          const subChunks = this.recursiveSplit(chunk, nextSeparators, startPos)
          chunks.push(...subChunks)
        } else {
          const tokens = this._config.tokenizer.encode(chunk)
          if (tokens.length > this._config.chunkSize) {
            const subChunks = this.recursiveSplit(
              chunk,
              nextSeparators,
              startPos
            )
            chunks.push(...subChunks)
          } else {
            chunks.push({
              endOverlap: [],
              endPos: endPos,
              startOverlap: [],
              startPos: startPos,
              text: chunk,
              tokens: tokens
            })
          }
        }

        startPos = endPos + 1
      }
    }

    return this.combineChunks(chunks)
  }

  split(text) {
    const chunks = this.recursiveSplit(text, this._config.separators, 0)

    const that = this
    function getOverlapTokens(tokens) {
      if (tokens == undefined) {
        return []
      } else {
        const length = Math.min(tokens.length, that._config.chunkOverlap)
        return tokens.slice(0, length)
      }
    }

    // Add overlap tokens and text to the start and end of each chunk
    if (this._config.chunkOverlap > 0) {
      for (let index = 1; index < chunks.length; index++) {
        const previousChunk = chunks[index - 1]
        const chunk = chunks[index]
        const nextChunk =
          index < chunks.length - 1 ? chunks[index + 1] : undefined
        chunk.startOverlap = getOverlapTokens(
          previousChunk.tokens.reverse()
        ).reverse()
        chunk.endOverlap = getOverlapTokens(nextChunk?.tokens)
      }
    }

    return chunks
  }

  splitBySpaces(text) {
    const parts = []
    let tokens = this._config.tokenizer.encode(text)
    do {
      if (tokens.length <= this._config.chunkSize) {
        parts.push(this._config.tokenizer.decode(tokens))
        break
      } else {
        const span = tokens.splice(0, this._config.chunkSize)
        parts.push(this._config.tokenizer.decode(span))
      }
    } while (true)

    return parts
  }
}

export default TextSplitter

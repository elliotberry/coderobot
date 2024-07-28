import { PromptSectionBase } from "promptrix"

/**
 * A section that renders source code snippets from the code index.
 */
export class SourceCodeSection extends PromptSectionBase {
  /**
   * Creates a new 'SourceCodeSection' instance.
   * @param index Code index to use.
   * @param tokens Optional. Sizing strategy for this section. Defaults to `auto`.
   * @param userPrefix Optional. Prefix to use for text output. Defaults to `user: `.
   */
  constructor(index, tokens = -1, userPrefix = "user: ") {
    super(tokens, true, "\n", userPrefix)
    this._index = index
  }
  getSectionOptions(maxTokens) {
    if (maxTokens < 2000) {
      return { sections: 1, tokens: maxTokens }
    } else if (maxTokens <= 6000) {
      return { sections: 1, tokens: 2000 }
    } else {
      return { sections: 2, tokens: 2000 }
    }
  }
  async renderAsMessages(memory, functions, tokenizer, maxTokens) {
    // Query the code index
    const query = memory.get("input")
    const results = await this._index.query(query, {
      maxChunks: 2000,
      maxDocuments: 100
    })
    // Render code & text snippets
    let text = `Here are some snippets of code and text that might help:`
    const tokens = tokenizer.encode(text).length
    let remaining = maxTokens - tokens
    for (const result of results) {
      // Create title
      const title = `\n\npath: ${result.uri}\nsnippet:\n`
      const titleLength = tokenizer.encode(title).length
      if (remaining - titleLength < 0) {
        break
      }
      // Render sections
      const options = this.getSectionOptions(remaining - titleLength)
      const sections = await result.renderSections(
        Math.min(remaining, options.tokens),
        options.sections
      )
      // Add snippets to text
      for (const section of sections) {
        const length = section.tokenCount + titleLength
        if (remaining - length < 0) {
          break
        }
        text += title + section.text
        remaining -= length
      }
    }
    // Return as a user message
    return {
      length: maxTokens - remaining,
      output: [{ content: text, role: "user" }],
      tooLong: remaining < 0
    }
  }
}

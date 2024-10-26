export default class PromptSectionBase {
  constructor(
    tokens = -1,
    required = true,
    separator = '\n',
    textPrefix = ''
  ) {
    this.required = required;
    this.tokens = tokens;
    this.separator = separator;
    this.textPrefix = textPrefix;
  }

  async renderAsText(memory, functions, tokenizer, maxTokens) {
    const asMessages = await this.renderAsMessages(memory, functions, tokenizer, maxTokens);

    if (asMessages.output.length === 0) {
      return { output: '', length: 0, tooLong: false };
    }

    let text = asMessages.output.map((message) => PromptSectionBase.getMessageText(message)).join(this.separator);

    const prefixLength = tokenizer.encode(this.textPrefix).length;
    const separatorLength = tokenizer.encode(this.separator).length;
    let length = prefixLength + asMessages.length + ((asMessages.output.length - 1) * separatorLength);

    text = this.textPrefix + text;

    if (this.tokens > 1.0 && length > this.tokens) {
      const encoded = tokenizer.encode(text);
      text = tokenizer.decode(encoded.slice(0, this.tokens));
      length = this.tokens;
    }

    return { output: text, length: length, tooLong: length > maxTokens };
  }

  async renderAsMessages(memory, functions, tokenizer, maxTokens) {
    throw new Error('renderAsMessages must be implemented by subclass');
  }

  returnMessages(output, length, tokenizer, maxTokens) {
    if (this.tokens > 1.0) {
      while (length > this.tokens) {
        const msg = output.pop();
        const encoded = tokenizer.encode(PromptSectionBase.getMessageText(msg));
        length -= encoded.length;
        if (length < this.tokens) {
          const delta = this.tokens - length;
          const truncated = tokenizer.decode(encoded.slice(0, delta));
          output.push({ role: msg.role, content: truncated });
          length += delta;
        }
      }
    }

    return { output: output, length: length, tooLong: length > maxTokens };
  }

  static getMessageText(message) {
    let text = message.content ?? '';
    if (message.function_call) {
      text = JSON.stringify(message.function_call);
    } else if (message.name) {
      text = `${message.name} returned ${text}`;
    }

    return text;
  }
}
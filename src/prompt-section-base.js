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

  static getMessageText(message) {
    let text = message.content ?? '';
    if (message.function_call) {
      text = JSON.stringify(message.function_call);
    } else if (message.name) {
      text = `${message.name} returned ${text}`;
    }

    return text;
  }

  async renderAsMessages() {
    throw new Error('renderAsMessages must be implemented by subclass');
  }

  async renderAsText(memory, functions, tokenizer, maxTokens) {
    const asMessages = await this.renderAsMessages(memory, functions, tokenizer, maxTokens);

    if (asMessages.output.length === 0) {
      return { length: 0, output: '', tooLong: false };
    }

    let text = asMessages.output.map((message) => PromptSectionBase.getMessageText(message)).join(this.separator);

    const prefixLength = tokenizer.encode(this.textPrefix).length;
    const separatorLength = tokenizer.encode(this.separator).length;
    let length = prefixLength + asMessages.length + ((asMessages.output.length - 1) * separatorLength);

    text = this.textPrefix + text;

    if (this.tokens > 1 && length > this.tokens) {
      const encoded = tokenizer.encode(text);
      text = tokenizer.decode(encoded.slice(0, this.tokens));
      length = this.tokens;
    }

    return { length: length, output: text, tooLong: length > maxTokens };
  }

  returnMessages(output, length, tokenizer, maxTokens) {
    if (this.tokens > 1) {
      while (length > this.tokens) {
        const message = output.pop();
        const encoded = tokenizer.encode(PromptSectionBase.getMessageText(message));
        length -= encoded.length;
        if (length < this.tokens) {
          const delta = this.tokens - length;
          const truncated = tokenizer.decode(encoded.slice(0, delta));
          output.push({ content: truncated, role: message.role });
          length += delta;
        }
      }
    }

    return { length: length, output: output, tooLong: length > maxTokens };
  }
}
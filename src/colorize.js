import colorizer from "json-colorizer"

/**
 * Colorizes text for the console.
 */
const Colorize = {
  /**
   * Wraps the given text with the specified color code.
   * @param text Text to colorize.
   * @param colorCode Color code to use.
   */
  colorize(text, colorCode) {
    console.log(`${colorCode}${text}${this.colors.reset}`)
  },

  colors: {
    blue: "\u001B[34;1m",
    gray: "\u001B[90m",
    green: "\u001B[32m",
    magenta: "\u001B[35;1m",
    red: "\u001B[31;1m",
    reset: "\u001B[0m",
    yellow: "\u001B[33m"
  },

  /**
   * Renders the given text as error text.
   * @param error Error text to render.
   */
  error(error) {
    const message = typeof error === "string" ? error : error.message
    return this.colorize(message, this.colors.red)
  },

  /**
   * Renders the given text with a highlight to call attention.
   * @param message Text to highlight.
   */
  highlight(message) {
    return this.colorize(message, this.colors.blue)
  },

  /**
   * Renders the given text as general output text.
   * @param output Text to render.
   * @param quote Optional. Quote to use for strings. Defaults to `''`.
   * @param units Optional. Units to use for numbers. Defaults to `''`.
   */
  output(output, quote = "", units = "") {
    if (typeof output === "string") {
      return this.colorize(`${quote}${output}${quote}`, this.colors.green)
    } else if (typeof output === "object" && output !== null) {
      return colorizer(output, {
        colors: {
          BOOLEAN_LITERAL: "blue",
          BRACE: "white",
          BRACKET: "white",
          COLON: "white",
          COMMA: "white",
          NULL_LITERAL: "blue",
          NUMBER_LITERAL: "blue",
          STRING_KEY: "white",
          STRING_LITERAL: "green"
        },
        pretty: true
      })
    } else if (typeof output === "number") {
      return this.colorize(`${output}${units}`, this.colors.blue)
    } else {
      return this.colorize(output, this.colors.blue)
    }
  },

  /**
   * Renders the given text as progress text.
   * @param message Progress text to render.
   */
  progress(message) {
    return this.colorize(message, this.colors.gray)
  },

  /**
   * Replaces the current line with the given text.
   * @param text The text to replace the current line with.
   */
  replaceLine(text) {
    return `\u001B[A\u001B[2K${text}`
  },

  /**
   * Renders the given text as a title.
   * @param title Title text to render.
   */
  title(title) {
    return this.colorize(title, this.colors.magenta)
  },

  /**
   * Renders the given text as a value.
   * @param field Field name to render.
   * @param value Value to render.
   * @param units Optional. Units to use for numbers. Defaults to `''`.
   */
  value(field, value, units = "") {
    return `${field}: ${this.output(value, '"', units)}`
  },

  /**
   * Renders the given text as a warning.
   * @param warning Warning text to render.
   */
  warn(warning) {
    return this.colorize(warning, this.colors.yellow)
  }
}

export default Colorize

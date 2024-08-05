import { AlphaWave, OpenAIModel } from "alphawave"
import * as readline from "node:readline"
import {
  ConversationHistory,
  Prompt,
  SystemMessage,
  UserMessage
} from "promptrix"
import Colorize from "./colorize.js"
import { SourceCodeSection } from "./source-code-section.js"

/**
 * The main class for the Coderobot application.
 */
class Coderobot {
  /**
   * Creates a new `Coderobot` instance.
   * @param {Object} index - The code index to use.
   */
  constructor(index) {
    this._functions = new Map()
    this._index = index
  }

  /**
   * Registers a new function to be used in the chat completion.
   * @param {Object} schema - The schema of the function.
   * @param {Function} function_ - The function to be executed.
   * @returns {Coderobot} The instance of Coderobot for chaining.
   */
  addFunction(schema, function_) {
    this._functions.set(schema.name, { fn: function_, schema })
    return this
  }

  /**
   * Starts the chat session and listens for user input.
   */
  async chat() {
    const rl = readline.createInterface({
      input: process.stdin,
      output: process.stdout
    })

    const model = this.createModel()
    const wave = new AlphaWave({
      model,
      prompt: new Prompt([
        new SystemMessage(
          "You are an expert software developer.\nYou are chatting with another developer who is asking for help with the project they're working on."
        ),
        new SourceCodeSection(this._index, 0.6),
        new ConversationHistory("history", 0.4),
        new UserMessage("{{$input}}", 500)
      ])
    })

    const _that = this

    async function respond(botMessage) {
      async function completePrompt(input) {
        const result = await wave.completePrompt(input)

        switch (result.status) {
          case "success":
            const message = result.message
            if (message.function_call) {
              const entry = _that._functions.get(message.function_call.name)
              if (entry) {
                const args =
                  message.function_call.arguments ?
                    JSON.parse(message.function_call.arguments)
                  : {}
                const result = await entry.fn(args)
                wave.addFunctionResultToHistory(
                  message.function_call.name,
                  result
                )
                await completePrompt("")
              } else {
                respond(
                  Colorize.error(
                    `Function '${message.function_call.name}' was not found.`
                  )
                )
              }
            } else {
              await respond(Colorize.output(message.content))
            }
            break
          default:
            respond(
              Colorize.error(
                result.message ?
                  `${result.status}: ${result.message}`
                : `A result status of '${result.status}' was returned.`
              )
            )
            break
        }
      }

    
      rl.question("User: ", async (input) => {
        if (input.toLowerCase() === "exit") {
          rl.close()
          process.exit()
        } else {
          completePrompt(input)
        }
      })
    }

    respond(Colorize.output(">"))
  }

  createModel() {
    const functions = []
    for (const entry of this._functions.values()) {
      functions.push(entry.schema)
    }

    const modelOptions = {
      apiKey: this._index.keys.apiKey,
      completion_type: "chat",
      max_input_tokens: this._index.config.max_input_tokens,
      max_tokens: this._index.config.max_tokens,
      model: this._index.config.model,
      temperature: this._index.config.temperature
    }

    if (functions.length > 0) {
      modelOptions.functions = functions
    }

    return new OpenAIModel(modelOptions)
  }

  /**
   * Gets the code index.
   * @returns {Object} The code index.
   */
  get index() {
    return this._index
  }
}

export default Coderobot

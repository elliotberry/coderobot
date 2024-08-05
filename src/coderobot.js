import { AlphaWave, OpenAIModel } from "alphawave"
import * as readline from "node:readline"
import {
  ConversationHistory,
  Prompt,
  SystemMessage,
  UserMessage} from "promptrix"

import Colorize from "./colorize.js"
import { SourceCodeSection } from "./source-code-section.js"

/**
 * The main class for the Coderobot application.
 */
class Coderobot {
  /**
   * Creates a new `Coderobot` instance.
   * @param index The code index to use.
   */
  constructor(index) {
    this._functions = new Map()
    this._index = index
  }
  /**
   * Registers a new function to be used in the chat completion.
   * @remarks
   * This is used to add new capabilities to Coderobot's chat feature
   * @param name The name of the function.
   * @param schema The schema of the function.
   * @param fn The function to be executed.
   */
  addFunction(schema, function_) {
    this._functions.set(schema.name, { fn: function_, schema })
    return this
  }
  /**
   * Starts the chat session and listens for user input.
   */
  async chat() {
    // Create a readline interface object with the standard input and output streams
    const rl = readline.createInterface({
      input: process.stdin,
      output: process.stdout
    })
    // Create model and wave
    const model = this.createModel()
    const wave = new AlphaWave({
      model,
      prompt: new Prompt([
        new SystemMessage(
          [
            `You are an expert software developer.`,
            `You are chatting with another developer who is asking for help with the project they're working on.`
          ].join("\n")
        ),
        new SourceCodeSection(this._index, 0.6),
        new ConversationHistory("history", 0.4),
        new UserMessage("{{$input}}", 500)
      ])
    })
    // Define main chat loop
    const _that = this
    async function respond(botMessage) {
      async function completePrompt(input) {
        // Route users message to wave
        const result = await wave.completePrompt(input)
        switch (result.status) {
          case "success": {
            const message = result.message
            if (message.function_call) {
              // Call function and add result to history
              const entry = _that._functions.get(message.function_call.name)
              if (entry) {
                const arguments_ =
                  message.function_call.arguments ?
                    JSON.parse(message.function_call.arguments)
                  : {}
                const result = await entry.fn(arguments_)
                wave.addFunctionResultToHistory(
                  message.function_call.name,
                  result
                )
                // Call back in with the function result
                await completePrompt("")
              } else {
                respond(
                  Colorize.error(
                    `Function '${message.function_call.name}' was not found.`
                  )
                )
              }
            } else {
              // Call respond to display response and wait for user input
              await respond(Colorize.output(message.content))
            }
            break
          }
          default: {
            await (result.message ? respond(
                Colorize.error(`${result.status}: ${result.message}`)
              ) : respond(
                Colorize.error(
                  `A result status of '${result.status}' was returned.`
                )
              ));
            break
          }
        }
      }
      // Show the bots message
      console.log(botMessage)
      // Prompt the user for input
      rl.question("User: ", async (input) => {
        // Check if the user wants to exit the chat
        if (input.toLowerCase() === "exit") {
          // Close the readline interface and exit the process
          rl.close()
          process.exit()
        } else {
          // Complete the prompt using the user's input
          completePrompt(input)
        }
      })
    }
    // Start chat session
    respond(Colorize.output(`Hello, how can I help you?`))
  }
  createModel() {
    // Generate list of functions
    const functions = []
    for (const entry of this._functions.values()) {
      functions.push(entry.schema)
    }
    // Create an instance of a model
    const modelOptions = {
      apiKey: this._index.keys.apiKey,
      completion_type: "chat",
      max_input_tokens: this._index.config.max_input_tokens,
      max_tokens: this._index.config.max_tokens,
      model: this._index.config.model,
      temperature: this._index.config.temperature
      //logRequests: true
    }
    if (functions.length > 0) {
      modelOptions.functions = functions
    }
    return new OpenAIModel(modelOptions)
  }
  /**
   * Gets the code index.
   */
  get index() {
    return this._index
  }
}
export default Coderobot
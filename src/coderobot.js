import { AlphaWave, OpenAIModel } from "alphawave";
import * as readline from "node:readline";
import {
  ConversationHistory,
  Prompt,
  SystemMessage,
  UserMessage
} from "promptrix";
import addCreateFile from "./create-file.js";

import { SourceCodeSection } from "./source-code-section.js";

/**
 * The main class for the Coderobot application.
 */
class Coderobot {
  /**
   * Creates a new `Coderobot` instance.
   * @param index The code index to use.
   */
  constructor(index) {
    this._functions = new Map();
    this._index = index;
    addCreateFile(this);
    //addModifyFile(this)
  }

  /**
   * Registers a new function to be used in the chat completion.
   * @param schema The schema of the function.
   * @param function_ The function to be executed.
   */
  addFunction(schema, function_) {
    this._functions.set(schema.name, { fn: function_, schema });
    return this;
  }

  /**
   * Handles errors in the result.
   * @param result The result object containing status and message.
   */
  async errorResult(result) {
    const errorMessage = result.message
      ? `${result.status}: ${result.message}`
      : `A result status of '${result.status}' was returned.`;
   console.error(errorMessage);
  }

  /**
   * Processes the prompt completion.
   * @param wave The AlphaWave instance.
   * @param input The input to process.
   */
  async completePrompt(wave, input) {
    const result = await wave.completePrompt(input);
    switch (result.status) {
      case "success": {
        const message = result.message;
        if (message.function_call) {
          const entry = this._functions.get(message.function_call.name);
          if (entry) {
            const arguments_ = message.function_call.arguments
              ? JSON.parse(message.function_call.arguments)
              : {};
            const functionResult = await entry.fn(arguments_);
            wave.addFunctionResultToHistory(
              message.function_call.name,
              functionResult
            );
            await this.completePrompt(wave, "");
          } else {
            console.error(`Function '${message.function_call.name}' was not found.`);
          }
        }
        break;
      }
      default: {
        console.error(`${result.status}: ${result.message || 'An error occurred'}`);
        break;
      }
    }
  }

  /**
   * Starts the command session.
   * @param question The question to ask.
   */
  async command(question) {
    const model = this.createModel();
    const wave = new AlphaWave({
      model,
      prompt: new Prompt([
        new SystemMessage(
          `You are an expert software developer. You are answering a single question from another developer who is asking for help with the project they're working on.`
        ),
        new SourceCodeSection(this._index, 0.6),
        new UserMessage("{{$input}}", 500)
      ])
    });
    await this.completePrompt(wave, question);
  }

  /**
   * Handles user responses in the chat loop.
   * @param wave The AlphaWave instance.
   * @param rl The readline interface instance.
   * @param botMessage The message from the bot.
   */
  async respond(wave, rl, botMessage) {
    if (botMessage) {
      console.log(botMessage);
    }
    rl.question("User: ", async (input) => {
      if (input.toLowerCase() === "exit") {
        rl.close();
        process.exit();
      } else {
        await this.completePrompt(wave, input);
      }
    });
  }

  /**
   * Starts the chat session and listens for user input.
   */
  async chat() {
    const rl = readline.createInterface({
      input: process.stdin,
      output: process.stdout
    });

    const model = this.createModel();
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
    });

    await this.respond(wave, rl, null);
  }

  /**
   * Creates and returns the model to be used by AlphaWave.
   */
  createModel() {
    const functions = Array.from(this._functions.values()).map(entry => entry.schema);
    const modelOptions = {
      apiKey: this._index.keys.apiKey,
      completion_type: "chat",
      max_input_tokens: this._index.config.max_input_tokens,
      max_tokens: this._index.config.max_tokens,
      model: this._index.config.model,
      temperature: this._index.config.temperature
    };
    if (functions.length > 0) {
      modelOptions.functions = functions;
    }
    return new OpenAIModel(modelOptions);
  }

  /**
   * Gets the code index.
   */
  get index() {
    return this._index;
  }
}

export default Coderobot;
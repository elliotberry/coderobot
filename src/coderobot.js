import { ChatOpenAI } from "@langchain/openai";
import { ConversationChain } from "langchain";
import { PromptTemplate } from "langchain/prompts";
import * as readline from "node:readline";
import Colorize from "./colorize.js";
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
    this._functions.set(schema.name, { fn: function_, schema });
    return this;
  }

  /**
   * Starts the chat session and listens for user input.
   */
  async chat() {
    // Create a readline interface object with the standard input and output streams
    const rl = readline.createInterface({
      input: process.stdin,
      output: process.stdout,
    });

    // Create model and chain
    const model = this.createModel();
    const promptTemplate = new PromptTemplate({
      template: `
        You are an expert software developer.
        You are chatting with another developer who is asking for help with the project they're working on.
        {{source_code_section}}
        {{conversation_history}}
        User: {{input}}`,
      inputVariables: ["source_code_section", "conversation_history", "input"],
    });

    const chatChain = new ConversationChain({
      llm: model,
      prompt: promptTemplate,
    });

    const _that = this;

    async function respond(botMessage) {
      async function completePrompt(input) {
        try {
          const result = await chatChain.call({
            source_code_section: new SourceCodeSection(_that._index, 0.6),
            conversation_history: "", // You may need to manage the conversation history
            input: input,
          });

          if (result.output) {
            if (result.output.function_call) {
              // Call function and add result to history
              const entry = _that._functions.get(result.output.function_call.name);
              if (entry) {
                const args = result.output.function_call.arguments
                  ? JSON.parse(result.output.function_call.arguments)
                  : {};
                const fnResult = await entry.fn(args);
                // Add the function result to the conversation history if needed
                await completePrompt(""); // Call back in with the function result
              } else {
                respond(Colorize.error(`Function '${result.output.function_call.name}' was not found.`));
              }
            } else {
              await respond(Colorize.output(result.output.content));
            }
          } else {
            await respond(Colorize.error(`An error occurred: ${result}`));
          }
        } catch (error) {
          await respond(Colorize.error(`Error: ${error.message}`));
        }
      }

      // Show the bot's message
      console.log(botMessage);
      // Prompt the user for input
      rl.question("User: ", async (input) => {
        // Check if the user wants to exit the chat
        if (input.toLowerCase() === "exit") {
          // Close the readline interface and exit the process
          rl.close();
          process.exit();
        } else {
          // Complete the prompt using the user's input
          await completePrompt(input);
        }
      });
    }

    // Start chat session
    respond(Colorize.output(`Hello, how can I help you?`));
  }

  createModel() {
    // Generate list of functions
    const functions = [];
    for (const entry of this._functions.values()) {
      functions.push(entry.schema);
    }

    // Create an instance of a model
    const modelOptions = {
      openAIApiKey: this._index.keys.apiKey,
      modelName: this._index.config.model,
      temperature: this._index.config.temperature,
      maxTokens: this._index.config.max_tokens,
      // logRequests: true // Uncomment if you want to log requests
    };

    const model = new ChatOpenAI(modelOptions);
    return model;
  }

  /**
   * Gets the code index.
   */
  get index() {
    return this._index;
  }
}

export default Coderobot;
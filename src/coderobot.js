import { AlphaWave, OpenAIModel } from "alphawave";
import fs from "node:fs";
import path from "node:path";
import * as readline from "node:readline";
import { ConversationHistory, Prompt, SystemMessage, UserMessage } from "promptrix";

import addCreateFile from "./create-file.js";
import { SourceCodeSection } from "./source-code-section.js";

/**
 * Main class for the Coderobot application.
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
    //addModifyFile(this); // Uncomment to enable modify file functionality
  }

  /**
   * Registers a new function for chat completion.
   * @param schema The schema of the function.
   * @param fn The function to be executed.
   */
  addFunction(schema, function_) {
    this._functions.set(schema.name, { fn: function_, schema });
    return this;
  }

  /**
   * Starts a chat session and listens for user input.
   */
  async chat() {
    const rl = readline.createInterface({
      input: process.stdin,
      output: process.stdout,
    });

    const model = this.createModel();
    const wave = new AlphaWave({
      model,
      prompt: new Prompt([
        new SystemMessage(`You are an expert software developer chatting with another developer seeking project help.`),
        new SourceCodeSection(this._index, 0.6),
        new ConversationHistory("history", 0.4),
        new UserMessage("{{$input}}", 500),
      ]),
    });

    const completePrompt = async (input) => {
      console.log("Processing input...");
      const result = await wave.completePrompt(input);
      switch (result.status) {
        case "success": {
          const { content, function_call } = result.message;
          if (function_call) {
            const entry = this._functions.get(function_call.name);
            if (entry) {
              const arguments_ = function_call.arguments ? JSON.parse(function_call.arguments) : {};
              const result = await entry.fn(arguments_);
              wave.addFunctionResultToHistory(function_call.name, result);
              await completePrompt("");
            } else {
              respond(`Function '${function_call.name}' not found.`);
            }
          } else {
            this.saveConversation(input, content);
            respond(content);
          }
          break;
        }
        default: {
          respond(`${result.status}: ${result.message || "An error occurred"}`);
          break;
        }
      }
    };

    const respond = async (botMessage) => {
      if (botMessage) console.log(botMessage);
    
      const renderExitTip = () => {
        // Save current cursor position
        process.stdout.write("\u001B7");
        // Move cursor to the bottom line
        process.stdout.write("\u001B[s"); // Save cursor position
        process.stdout.write("\u001B[999;0H"); // Move cursor to the last line
        // Move up two lines to leave space for user input
        process.stdout.write("\u001B[1A");
        // Clear the current line and the line above it
        process.stdout.write("\u001B[2K\u001B[1A\u001B[2K");
    
        // Move to the last line to print the exit tip
        process.stdout.write("\u001B[999;0H"); // Move cursor to the last line
        // Print the exit tip in magenta color
        process.stdout.write("\u001B[35m(Tip: Type 'exit' anytime to leave this chat. 🐱‍💻)\u001B[0m\n");
    
        // Restore cursor position
        process.stdout.write("\u001B8");
      };
    
      const promptUser = () => {
        // Render the exit tip before showing the prompt
        renderExitTip();
        rl.question("User: ", async (input) => {
          if (input.toLowerCase() === "exit") {
            // Clear the tip line and extra input lines when exiting
            process.stdout.write("\u001B[999;0H"); // Move cursor to the last line
            process.stdout.write("\u001B[2K"); // Clear the last line
            process.stdout.write("\u001B[1A\u001B[2K"); // Clear the line above
            rl.close();
            process.exit();
            return;
          }
          await completePrompt(input);
          promptUser(); // Keep the interaction going
        });
      };
    
      promptUser(); // Start the interaction
    };

    respond("Hello, how can I help you?");
  }

  /**
   * Processes a command with a given question.
   * @param question The question to process.
   */
  async command(question) {
    const model = this.createModel();
    const wave = new AlphaWave({
      model,
      prompt: new Prompt([
        new SystemMessage(`You are an expert software developer helping another developer with their project.`),
        new SourceCodeSection(this._index, 0.6),
        new UserMessage("{{$input}}", 500),
      ]),
    });

    const completePrompt = async (input) => {
      console.log("Processing input...");
      const result = await wave.completePrompt(input);
      switch (result.status) {
        case "success": {
          const { content, function_call } = result.message;
          console.log(content);
          this.saveConversation(question, content);

          if (function_call) {
            const entry = this._functions.get(function_call.name);
            if (entry) {
              const arguments_ = function_call.arguments ? JSON.parse(function_call.arguments) : {};
              const result = await entry.fn(arguments_);
              wave.addFunctionResultToHistory(function_call.name, result);
              await completePrompt("");
            } else {
              console.error(`Function '${function_call.name}' not found.`);
            }
          }
          break;
        }
        default: {
          console.error(`${result.status}: ${result.message || "An error occurred"}`);
          break;
        }
      }
    };

    await completePrompt(question);
  }

  /**
   * Creates and returns the model instance.
   */
  createModel() {
    const functions = [...this._functions.values()].map((entry) => entry.schema);
    const modelOptions = {
      apiKey: process.env.OPENAI_API_KEY,
      completion_type: "chat",
      max_input_tokens: this._index.config.max_input_tokens,
      max_tokens: this._index.config.max_tokens,
      model: this._index.config.model,
      temperature: this._index.config.temperature,
    };

    if (functions.length > 0) modelOptions.functions = functions;
    return new OpenAIModel(modelOptions);
  }

  async errorResult(result) {
    console.error(result.message ? `${result.status}: ${result.message}` : `Result status '${result.status}' was returned.`);
  }

  /**
   * Save question and reply to a file in the indexed folder.
   * @param question The user's question.
   * @param reply The bot's reply.
   */
  saveConversation(question, reply) {
    const folderPath = this._index.folderPath;
    const timestamp = new Date().toISOString();
    const filename = `conversation-${timestamp}.txt`;
    const filepath = path.join(folderPath, filename);

    const content = `User: ${question}\nBot: ${reply}\n`;

    fs.appendFile(filepath, content, (error) => {
      if (error) {
        console.error("Failed to save conversation:", error);
      } else {
      //  console.log("Conversation saved successfully.");
      }
    });
  }

  /**
   * Returns the code index.
   */
  get index() {
    return this._index;
  }
}

export default Coderobot;

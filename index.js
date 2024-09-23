import { hideBin } from "yargs/helpers"
import yargs from "yargs/yargs"

import { CodeIndex } from "./src/code-index.js"
import Coderobot from "./src/coderobot.js"

const verifyIndex = async () => {
  // Ensure index exists and has keys
  const index = new CodeIndex()
  if (!(await index.isCreated())) {
    console.log(
      `We need to first create an index. Run index command.`
    )

    return
  }

  // Load index
  await index.load()
  return index
}

/**
 * Defines the commands supported by the coderobot CLI.
 */
export async function run() {
  const arguments_ = await yargs(hideBin(process.argv))
    .scriptName("coderobot")
    .command("$0", "chat mode", {}, async () => {
      const index = await verifyIndex()
      // Start a Coderobot chat session
      const coderobot = new Coderobot(index)
      await coderobot.chat()
    })
    .command("cmd", "cmd mode", {}, async (t) => {
      const index = await verifyIndex()
      // Start a Coderobot chat session
      const coderobot = new Coderobot(index)

      await coderobot.command(t._[1])
    })
    .command(
      "create",
      `creates a new code index`,
      (yargs) => {
        return yargs
          .option("key", {
            alias: "k",
            describe:
              "OpenAI API key to use for generating embeddings and querying the model.",
            type: "string"
          })
          .option("model", {
            alias: "m",
            default: "gpt-4o",
            describe:
              'OpenAI model to use for queries. Defaults to "gpt-3.5-turbo-16k".',
            type: "string"
          })
          .option("source", {
            alias: "s",
            array: true,
            default: "./",
            describe: "source folder(s) to index.",
            type: "string"
          })
          .option("command", {
            alias: "e",
            array: true,
            describe: "issue a single question to gpt.",
            type: "string"
          })
      },
      async ({ extension, key, model, source }) => {
        if (!key) {
          if (process.env.OPENAI_API_KEY) {
            key = process.env.OPENAI_API_KEY
          } else {
            throw new Error(
              `You must provide an OpenAI API key to create an index.`
            )
          }
        }
        if (!source) {
          source = ["./"]
        }
        console.log(`Creating new code index`)
        // Get optimal config
        const config = getOptimalConfig(model, source, extension)
        // Create index
        const index = new CodeIndex()
        await index.create({ apiKey: key }, config)

        console.log(`New index created under the '${index.folderPath}' folder.`)

        // Build index
        await index.rebuild()

        console.log(`The index for your source code has been built.`)
      }
    )
    .command(
      "delete",
      `delete an existing code index`,
      {},
      async (arguments_) => {
        const index = new CodeIndex()
        await index.delete()
        console.log(`Your index was deleted.`)
      }
    )
    .command(
      "add",
      `adds additional source folders and/or extension filters to your code index`,
      (yargs) => {
        return yargs
          .option("source", {
            alias: "s",
            array: true,
            describe: "source folder(s) to index.",
            type: "string"
          })
          .option("extension", {
            alias: "e",
            array: true,
            describe: "extension(s) to filter to.",
            type: "string"
          })
      },
      async (arguments_) => {
        // Ensure index exists and has keys
        const index = new CodeIndex()
        if (!(await index.isCreated())) {
         
            console.log(
              `No index was found. Please run 'Coderobot create' first.`
            )
          
          return
        }
        if (!(await index.hasKeys())) {
        
            console.log(
              `A Coderobot index was found but you haven't configured your personal OpenAI key.`
            )
          
          return
        }
        // Add sources and/or extensions
        console.log("Updating sources and/or extensions")
        await index.add({
          extensions: arguments_.extension,
          sources: arguments_.source
        })
        console.log(
          `Your sources and/or extensions have been updated. You can rebuild your index by running: Coderobot rebuild\n`
        )
      }
    )
    .command("rebuild", "chat mode", {}, async () => {
      // Ensure index exists and has keys
      const index = new CodeIndex()
      if (!(await index.isCreated())) {
    
          console.log(
            `No index was found. Please run 'Coderobot create' first.`
          )
        
        return
      }
      if (!(await index.hasKeys())) {
        console.log(
          `A Coderobot index was found but you haven't configured your personal OpenAI key.`
        )

        return
      }
      // Rebuild index
      console.log("Rebuilding code index")
      await index.rebuild()

      console.log(`The index for your source code has been rebuilt.`)
    })
    .command(
      "remove",
      `removes source folders and/or extension filters from your code index`,
      (yargs) => {
        return yargs
          .option("source", {
            alias: "s",
            array: true,
            describe: "source folder(s) to index.",
            type: "string"
          })
          .option("extension", {
            alias: "e",
            array: true,
            describe: "extension(s) to filter to.",
            type: "string"
          })
      },
      async (arguments_) => {
        // Ensure index exists and has keys
        const index = new CodeIndex()
        if (!(await index.isCreated())) {
          
            console.log(
              `No index was found. Please run 'coderobot create' first.`
            )
          
          return
        }
        if (!(await index.hasKeys())) {
          console.log(
            `A Coderobot index was found but you haven't configured your personal OpenAI key.`
          )

          return
        }
        // Removing sources and/or extensions
        console.log("Updating sources and/or extensions")
        await index.remove({
          extensions: arguments_.extension,
          sources: arguments_.source
        })

        console.log(
          `Your sources and/or extensions have been updated.You can rebuild your index by running Coderobot rebuild`
        )
      }
    )
    .command(
      "set",
      `creates a new code index`,
      (yargs) => {
        return yargs
          .option("key", {
            alias: "k",
            describe:
              "OpenAI API key to use for generating embeddings and querying the model.",
            type: "string"
          })
          .option("model", {
            alias: "m",
            describe:
              'OpenAI model to use for queries. Defaults to "gpt-3.5-turbo-16k".',
            type: "string"
          })
      },
      async (arguments_) => {
        const index = new CodeIndex()
       // if (arguments_.key) {
       //   console.log(`Updating OpenAI key`)
       //   await index.setKeys({ apiKey: arguments_.key })
       // }
        if (!arguments_.model) {
          return
        }
        console.log(`Updating model`)
        const config = getOptimalConfig(
          arguments_.model,
          arguments_.source,
          arguments_.extension
        )
        index.setConfig(config)
      }
    )
    .help()
    .demandCommand()
    .parseAsync()
}

function getOptimalConfig(model, sources, extensions) {
  const config = {
    extensions,
    model,
    sources,
    temperature: 0.2
  }
  if (model.startsWith("gpt-3.5-turbo-16k")) {
    config.max_input_tokens = 12_000
    config.max_tokens = 3000
  } else if (model.startsWith("gpt-3.5-turbo-instruct")) {
    throw new Error(`The 'gpt-3.5-turbo-instruct' model is not yet supported.`)
  } else if (model.startsWith("gpt-3.5-turbo")) {
    config.max_input_tokens = 3000
    config.max_tokens = 800
  } else if (model.startsWith("gpt-4-32k")) {
    config.max_input_tokens = 24_000
    config.max_tokens = 6000
  } else if (model.startsWith("gpt-4")) {
    config.max_input_tokens = 6000
    config.max_tokens = 1500
  } else if (model.startsWith("gpt-4o")) {
    config.max_input_tokens = 12_000
    config.max_tokens = 4000
  } else {
    throw new Error(`The '${model}' model is not yet supported.`)
  }
  return config
}

run()

import { hideBin } from "yargs/helpers"
import yargs from "yargs/yargs"

import { CodeIndex } from "./code-index.js"
import Coderobot from "./coderobot.js"
import Colorize from "./colorize.js"
import { registerFunctions } from "./create-file.js"
/**
 * Defines the commands supported by the coderobot CLI.
 */
export async function run() {
  // prettier-ignore
  const arguments_ = await yargs(hideBin(process.argv))
        .scriptName('coderobot')
        .command('$0', 'chat mode', {}, async () => {
        // Ensure index exists and has keys
        const index = new CodeIndex();
        if (!await index.isCreated()) {
            console.log(Colorize.output([
                `We need to first create an index before you can chat with coderobot.`,
                `You'll need to provide an OpenAI API key and a source folder to index.`,
                `You can create an OpenAI API key at https://platform.openai.com/account/api-keys.`,
                `A paid account is recommended but OpenAI will give you $5 in free credits to get started.`,
                `Once you have your OpenAI API key, you can create a new index by running:\n`,
                `coderobot create --key <api key> --source <source folder> [--source <additional source folder>]\n`,
                `By default, all files under your source folders will be included in the index.`,
                `If you'd only like certain file extensions to be indexed, you can add the "--extension <included extensions> [--extension <additional extension>]" option.`,
                `Once the index has finished building, you can start chatting with coderobot by running:\n`,
                `coderobot\n`,
            ].join(`\n`)));
            return;
        }
        if (!await index.hasKeys()) {
            console.log(Colorize.output([
                `A Coderobot index was found but you haven't configured your personal OpenAI key.`,
                `You'll need to provide an OpenAI API key before you can continue.`,
                `You can create an OpenAI API key at https://platform.openai.com/account/api-keys.`,
                `A paid account is recommended but OpenAI will give you $5 in free credits to get started.`,
                `Once you have your OpenAI API key, you can configure your local index to use that key by running:\n`,
                `Coderobot set --key <api key>\n`,
                `Once you've configured your personal key, you can start chatting with Coderobot by running:\n`,
                `Coderobot\n`,
            ].join(`\n`)));
            return;
        }
        // Load index
        await index.load();
        // Start a Coderobot chat session
        const coderobot = new Coderobot(index);
        registerFunctions(coderobot);
        await coderobot.chat();
    })
        .command('create', `creates a new code index`, (yargs) => {
        return yargs
            .option('key', {
            alias: 'k',
            describe: 'OpenAI API key to use for generating embeddings and querying the model.',
            type: 'string'
        })
            .option('model', {
            alias: 'm',
            default: 'gpt-4o',
            describe: 'OpenAI model to use for queries. Defaults to "gpt-3.5-turbo-16k".',
            type: 'string'
        })
            .option('source', {
            alias: 's',
            array: true,
            describe: 'source folder(s) to index.',
            type: 'string',
            "default": "./"
        })
            .option('extension', {
            alias: 'e',
            array: true,
            describe: 'extension(s) to filter to.',
            type: 'string'
        })
            .demandOption(['key', 'source']);
    }, async ({model, key, source, extension}) => {
        console.log(Colorize.title(`Creating new code index`));
        // Get optimal config
        const config = getOptimalConfig(model, source, extension);
        // Create index
        const index = new CodeIndex();
        await index.create({ apiKey: key }, config);
        console.log(Colorize.output([
            `I created a new code index under the '${index.folderPath}' folder.`,
            `Building the index can take a while depending on the size of your source folders.\n`,
        ].join('\n')));
        // Build index
        await index.rebuild();
        console.log(Colorize.output([
            `\nThe index for your source code has been built.`,
            `You can add additional sources and/or extension filters to your index by running:\n`,
            `Coderobot add --source <source folder> [--source <additional source folder>] [--extension <included extensions> [--extension <additional extension>]]\n`,
            `You current model is '${index.config.model}'. You can change the model by running:\n`,
            `Coderobot set --model <model name>\n`,
            `Only chat completion based models are currently supported.`,
            `To start chatting with Coderobot simply run:\n`,
            `Coderobot\n`,
        ].join('\n')));
    })
        .command('delete', `delete an existing code index`, {}, async (arguments_) => {
        const index = new CodeIndex();
        await index.delete();
        console.log(Colorize.output(`Your index was deleted.`));
    })
        .command('add', `adds additional source folders and/or extension filters to your code index`, (yargs) => {
        return yargs
            .option('source', {
            alias: 's',
            array: true,
            describe: 'source folder(s) to index.',
            type: 'string'
        })
            .option('extension', {
            alias: 'e',
            array: true,
            describe: 'extension(s) to filter to.',
            type: 'string'
        });
    }, async (arguments_) => {
        // Ensure index exists and has keys
        const index = new CodeIndex();
        if (!await index.isCreated()) {
            console.log(Colorize.output(`No index was found. Please run 'Coderobot create' first.`));
            return;
        }
        if (!await index.hasKeys()) {
            console.log(Colorize.output([
                `A Coderobot index was found but you haven't configured your personal OpenAI key.`,
                `You'll need to provide an OpenAI API key before you can continue.`,
                `You can create an OpenAI API key at https://platform.openai.com/account/api-keys.`,
                `A paid account is recommended but OpenAI will give you $5 in free credits to get started.`,
                `Once you have your OpenAI API key, you can configure your local index to use that key by running:\n`,
                `Coderobot set --key <api key>\n`,
                `Once you've configured your personal key, you can re-run your command.`,
            ].join(`\n`)));
            return;
        }
        // Add sources and/or extensions
        console.log(Colorize.title('Updating sources and/or extensions'));
        await index.add({
            extensions: arguments_.extension,
            sources: arguments_.source
        });
        console.log(Colorize.output([
            `Your sources and/or extensions have been updated.`,
            `You can rebuild your index by running:\n`,
            `Coderobot rebuild\n`,
        ].join('\n')));
    })
        .command('rebuild', 'chat mode', {}, async () => {
        // Ensure index exists and has keys
        const index = new CodeIndex();
        if (!await index.isCreated()) {
            console.log(Colorize.output(`No index was found. Please run 'Coderobot create' first.`));
            return;
        }
        if (!await index.hasKeys()) {
            console.log(Colorize.output([
                `A Coderobot index was found but you haven't configured your personal OpenAI key.`,
                `You'll need to provide an OpenAI API key before you can continue.`,
                `You can create an OpenAI API key at https://platform.openai.com/account/api-keys.`,
                `A paid account is recommended but OpenAI will give you $5 in free credits to get started.`,
                `Once you have your OpenAI API key, you can configure your local index to use that key by running:\n`,
                `Coderobot set --key <api key>\n`,
                `Once you've configured your personal key, you can re-run your command.`,
            ].join(`\n`)));
            return;
        }
        // Rebuild index
        console.log(Colorize.title('Rebuilding code index'));
        await index.rebuild();
        console.log(Colorize.output([
            `\nThe index for your source code has been rebuilt.`,
            `To start chatting with Coderobot run:\n`,
            `Coderobot\n`,
        ].join('\n')));
    })
        .command('remove', `removes source folders and/or extension filters from your code index`, (yargs) => {
        return yargs
            .option('source', {
            alias: 's',
            array: true,
            describe: 'source folder(s) to index.',
            type: 'string'
        })
            .option('extension', {
            alias: 'e',
            array: true,
            describe: 'extension(s) to filter to.',
            type: 'string'
        });
    }, async (arguments_) => {
        // Ensure index exists and has keys
        const index = new CodeIndex();
        if (!await index.isCreated()) {
            console.log(Colorize.output(`No index was found. Please run 'Coderobot create' first.`));
            return;
        }
        if (!await index.hasKeys()) {
            console.log(Colorize.output([
                `A Coderobot index was found but you haven't configured your personal OpenAI key.`,
                `You'll need to provide an OpenAI API key before you can continue.`,
                `You can create an OpenAI API key at https://platform.openai.com/account/api-keys.`,
                `A paid account is recommended but OpenAI will give you $5 in free credits to get started.`,
                `Once you have your OpenAI API key, you can configure your local index to use that key by running:\n`,
                `Coderobot set --key <api key>\n`,
                `Once you've configured your personal key, you can re-run your command.`,
            ].join(`\n`)));
            return;
        }
        // Removing sources and/or extensions
        console.log(Colorize.title('Updating sources and/or extensions'));
        await index.remove({
            extensions: arguments_.extension,
            sources: arguments_.source
        });
        console.log(Colorize.output([
            `Your sources and/or extensions have been updated.`,
            `You can rebuild your index by running:\n`,
            `Coderobot rebuild\n`,
        ].join('\n')));
    })
        .command('set', `creates a new code index`, (yargs) => {
        return yargs
            .option('key', {
            alias: 'k',
            describe: 'OpenAI API key to use for generating embeddings and querying the model.',
            type: 'string'
        })
            .option('model', {
            alias: 'm',
            describe: 'OpenAI model to use for queries. Defaults to "gpt-3.5-turbo-16k".',
            type: 'string'
        });
    }, async (arguments_) => {
        const index = new CodeIndex();
        if (arguments_.key) {
            console.log(Colorize.output(`Updating OpenAI key`));
            await index.setKeys({ apiKey: arguments_.key });
        }
        if (!arguments_.model) {
            return;
        }
        console.log(Colorize.output(`Updating model`));
        const config = getOptimalConfig(arguments_.model, arguments_.source, arguments_.extension);
        index.setConfig(config);
    })
        .help()
        .demandCommand()
        .parseAsync();
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

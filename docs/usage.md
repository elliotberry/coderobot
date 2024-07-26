# Coderobot Usage

Welcome to the usage guide for Coderobots Command Line Interface (CLI)! Coderobot is a powerful programming tool that serves as your expert companion in navigating and understanding your codebase. With Coderobot, you can harness the power of AI to get instant answers, suggestions, and insights related to your code.

Whether you're a beginner looking for guidance or an experienced developer seeking to optimize your workflow, Coderobot is here to assist you. From providing code snippets and examples to helping you troubleshoot issues and explore different parts of your codebase, Coderobot is your go-to resource for code-related queries.

In this guide, we'll walk you through the installation process, getting started with Coderobot, utilizing its features, and customizing its behavior. Let's dive in and unlock the full potential of Coderobot!

## Installation

To install Coderobot, you need a recent version of [Node.js](https://nodejs.org/en) and npm (Node Package Manager) installed on your machine. Then, you can run the following command to install Coderobot globally:

```bash
npm install -g @stevenic/Coderobot
```

## Getting Started

To get started with Coderobot, follow these steps:

1. Install Coderobot globally on your machine by running the following command:

   ```bash
   npm install -g @stevenic/Coderobot
   ```

2. Navigate to your project's root directory in the terminal.

3. Run the following command to start a new chat session with Coderobot:

   ```bash
   Coderobot
   ```

4. Coderobot will guide you through the steps needed to set up a code index for your repository. You'll need an OpenAI API key to proceed. If you don't have an API key, you can [get one here](https://platform.openai.com/account/api-keys).

5. Once you have your API key, enter it when prompted by Coderobot.

6. Coderobot will then start indexing your codebase and generating embeddings for your code.

7. Once the indexing process is complete, you can start asking questions or making requests related to your code. Coderobot will use its AI models and knowledge of your codebase to provide helpful suggestions and answers.

   For example, you can ask Coderobot to add new features to your code or generate documentation for your classes.

8. Coderobot will generate responses based on the context of your question or request.

That's it! You're now ready to use Coderobot to navigate and understand your codebase.

## Working with Coderobot

Here are a few tips to get you started using Coderobot:

- Document your code. Coderobot uses Semantic Search and a local Vector Index to retrieve code related to your request so more comments you have in your code the better the chance that Coderobot will find the code needed to answer your request.
- Be as specific as you can with your requests. Long descriptions telling Coderobot exactly what you want it to do and which classes or types it should use, will yield better results.
- Coderobot has a little bit of short term memory that lasts for the duration of current session. If you aren't completely satisfied with the code Coderobot generated just tell it the changes you want it to make.
- Coderobot also has the ability to create new files in your project so if you see some code you like, just ask it to write it to a file. But keep an eye out because Coderobot will sometimes create files when you don't expect it to.
- To end the current chat session just say "exit".

## Adding and Removing Sources

To add a new folder or file to your code index, you can use the `Coderobot add` command. This command allows you to specify one or more source paths that you want to add to your index. Here's an example of how to use the `Coderobot add` command:

```bash
Coderobot add --source <folder or file path>
```

Replace `<folder or file path>` with the path to the folder or file that you want to add. You can also pass multiple `--source` options to add multiple folders or files at once.

Similarly, to remove a folder or file from your code index, you can use the `Coderobot remove` command. This command also accepts one or more source paths that you want to remove from your index. Here's an example of how to use the `Coderobot remove` command:

```bash
Coderobot remove --source <folder or file path>
```

Replace `<folder or file path>` with the path to the folder or file that you want to remove. You can pass multiple `--source` options to remove multiple folders or files at once.

Note: When you add or remove a source from your index, you currently need to manually rebuild it by running `Coderobot rebuild`. Coderobot has already given me grief for not having a watch feature, and it even offered up the code, so coming soon :)

## Adding and Removing Extension Filters

To add or remove extension filters in the code index, you can use the `Coderobot addExtensionFilter` and `Coderobot removeExtensionFilter` commands respectively. These commands allow you to specify the file extensions that you want to include or exclude from the code index.

To add an extension filter, use the following command:

```bash
Coderobot add --extension <file extension to include>
```

Replace `<file extension to include>` with the file extension that you want to include in the code index. For example, to include JavaScript files, you would use `--extension .js`.

By default, all file extensions are indexed. However, once you start adding extension filters, only files with those extensions will be indexed.

To remove an extension filter, use the following command:

```bash
Coderobot remove --extension <file extension to remove>
```

Replace `<file extension to remove>` with the file extension that you want to remove from the code index. For example, to remove TypeScript files, you would use `--extension .ts`.

Note: When you add or remove a extension filters from your index, you currently need to manually rebuild it by running `Coderobot rebuild`.

## Setting Models and API Keys

To set the API key used by Coderobot, you can use the `Coderobot set --key <your OpenAI key>` command. This command allows you to update the API key in the local configuration.

To switch to using a different model, you can use the `Coderobot set --model <OpenAI model name>` command. This command allows you to specify the name of the model you want to use.

Note that only chat completion models are currently supported.

When you switch models, you need to manually rebuild the index by running the `Coderobot rebuild` command.

## Additional Commands

You can get a full list of commands that Coderobot supports by running `Coderobot --help`.

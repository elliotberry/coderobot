
import fs from "node:fs/promises";
import path from "node:path";

import Colorize from "./colorize.js";

/**
 * Schema for a function that creates a file at the specified path.
 */
const createFileFunction = {
    description: "Creates a new file at the specified path. Only use for new files not existing ones.",
    name: "createFile",
    parameters: {
        properties: {
            contents: {
                description: "The contents to write to the new file",
                type: "string"
            },
            filePath: {
                description: "The path to the file to create",
                type: "string"
            }
        },
        required: ["filePath", "contents"],
        type: "object"
    }
};

/**
 * Adds the createFile function to the coderobot instance.
 */
export function addCreateFile(coderobot) {
    coderobot.addFunction(createFileFunction, async (arguments_) => {
        const { contents, filePath } = arguments_;

        // Check if the file already exists
        if (await fs.access(path.join(process.cwd(), filePath)).then(() => true).catch(() => false)) {
            return `A file already exists at that path.\nGive the user detailed instructions for how they should modify that file instead.`;
        }

        try {
            // Create the directory path if it doesn't exist
            const directoryPath = path.dirname(filePath);
            await fs.mkdir(directoryPath, { recursive: true });

            // Write the code to the file
            await fs.writeFile(path.join(process.cwd(), filePath), contents);

            // Add the file to the code index
            await coderobot.index.upsertDocument(filePath);
            console.log(Colorize.highlight(`Created a new file: ${filePath}`));
            return `Successfully created file at ${filePath}`;
        } catch (error) {
            return `Failed to create file at ${filePath} due to the following error:\n${error.message}`;
        }
    });
}


import fs from "node:fs/promises";
import path from "node:path";
const unified = require("unified");
const parse = require("remark-parse");
const diff = require("remark-diff");
import Colorize from "./colorize.js";

/**
 * Schema for a function that creates a file at the specified path.
 */
const modifyFileFunction = {
    description: "Modifies existing files. Use to update existing files at the user's request.",
    name: "createFile",
    parameters: {
        properties: {
            contents: {
                description: "The delta of the changed file contents, in unified diff format",
                type: "string"
            },
            filePath: {
                description: "The path to the file to modify",
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
export function addModifyFile(coderobot) {
    coderobot.addFunction(modifyFileFunction, async (arguments_) => {
        const { contents, filePath } = arguments_;

        // Check if the file already exists
        if (!await fs.access(path.join(process.cwd(), filePath)).then(() => true).catch(() => false)) {
            return `A to edit does not exist at that path.\nGive the user detailed instructions for how they should create that file instead.`;
        }

        try {
            // Create the directory path if it doesn't exist
            const directoryPath = path.dirname(filePath);
            await fs.mkdir(directoryPath, { recursive: true });

            // Read the existing file contents
            const existingContents = await fs.readFile(path.join(process.cwd(), filePath), "utf8");

            // Apply the diff to the existing contents

            const processor = unified().use(parse).use(diff, { diff: contents });
            const result = await processor.process(existingContents);
            const newContents = String(result);

            // Write the code to the file
            await fs.writeFile(path.join(process.cwd(), filePath), newContents);
           
            // Add the file to the code index
            await coderobot.index.upsertDocument(filePath);
            console.log(Colorize.highlight(`Modified a file: ${filePath}`));
            return `Successfully Modified file at ${filePath}`;
        } catch (error) {
            return `Failed to create file at ${filePath} due to the following error:\n${error.message}`;
        }
    });
}



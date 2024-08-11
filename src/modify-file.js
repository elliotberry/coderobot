
import fs from "node:fs/promises";
import path from "node:path";


import Colorize from "./colorize.js";


async function applyUnifiedDiff(filePath, unifiedDiff) {
    const fileContent = await fs.readFile(filePath, 'utf8');
    const fileLines = fileContent.split('\n');

    const diffLines = unifiedDiff.split('\n');
    let lineOffset = 0;

    for (let i = 0; i < diffLines.length; i++) {
        const line = diffLines[i];

        // Find the start of the diff hunk
        if (line.startsWith('@@')) {
            const hunkHeader = line;
            const match = hunkHeader.match(/@@ \-(\d+),(\d+) \+(\d+),(\d+) @@/);
            if (!match) continue;

            const oldStartLine = parseInt(match[1], 10) - 1; // 0-based index
            const newStartLine = parseInt(match[3], 10) - 1;

            let j = i + 1;
            while (j < diffLines.length && !diffLines[j].startsWith('@@')) {
                const diffLine = diffLines[j];
                if (diffLine.startsWith('-')) {
                    fileLines.splice(oldStartLine + lineOffset, 1);
                    lineOffset--;
                } else if (diffLine.startsWith('+')) {
                    fileLines.splice(newStartLine + lineOffset, 0, diffLine.slice(1));
                    lineOffset++;
                } else if (diffLine.startsWith(' ')) {
                    oldStartLine++;
                    newStartLine++;
                }
                j++;
            }

            i = j - 1; // Skip to the next hunk
        }
    }

    await fs.writeFile(filePath, fileLines.join('\n'), 'utf8');
}
/**
 * Schema for a function that creates a file at the specified path.
 */
const modifyFileFunction = {
    description: "Modifies existing files. Use to update existing files at the user's request.",
    name: "createFile",
    parameters: {
        properties: {
            changedContentDiff: {
                description: "The delta of the changed file contents, in unified diff format",
                type: "string"
            },
            filePath: {
                description: "The path to the file to modify",
                type: "string"
            }
        },
        required: ["filePath", "changedContentDiff"],
        type: "object"
    }
};

/**
 * Adds the createFile function to the coderobot instance.
 */
export function addModifyFile(coderobot) {
    coderobot.addFunction(modifyFileFunction, async (arguments_) => {
        const { changedContentDiff, filePath } = arguments_;
        console.log("Modifying file at", filePath);
        // Check if the file already exists
        if (!await fs.access(path.join(process.cwd(), filePath)).then(() => true).catch(() => false)) {
            return `A to edit does not exist at that path.\nGive the user detailed instructions for how they should create that file instead.`;
        }

        try {
            // Create the directory path if it doesn't exist
            const directoryPath = path.dirname(filePath);
            await fs.mkdir(directoryPath, { recursive: true });

            // Apply the unified diff to the file
            await applyUnifiedDiff(path.join(process.cwd(), filePath), changedContentDiff);
            // Write the code to the file
            //await fs.writeFile(path.join(process.cwd(), filePath), newContents);
           
            // Add the file to the code index
            await coderobot.index.upsertDocument(filePath);
            console.log(Colorize.highlight(`Modified a file: ${filePath}`));
            return `Successfully Modified file at ${filePath}`;
        } catch (error) {
            return `Failed to create file at ${filePath} due to the following error:\n${error.message}`;
        }
    });
}



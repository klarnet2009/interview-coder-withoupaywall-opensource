/**
 * PdfParserService — Extracts raw text from PDF files
 * Uses pdf-parse (pure JS, no native deps)
 */
import fs from "node:fs/promises";
import { dialog } from "electron";
import { createScopedLogger } from "../logger";

const logger = createScopedLogger("pdf-parser");

export interface ParsedPdf {
    text: string;
    pageCount: number;
    fileName: string;
    filePath: string;
}

/**
 * Open a file dialog and parse the selected PDF
 */
export async function openAndParsePdf(): Promise<ParsedPdf | null> {
    const result = await dialog.showOpenDialog({
        title: "Select PDF File",
        filters: [
            { name: "PDF Documents", extensions: ["pdf"] },
            { name: "All Files", extensions: ["*"] }
        ],
        properties: ["openFile"]
    });

    if (result.canceled || result.filePaths.length === 0) {
        return null;
    }

    return parsePdfFromPath(result.filePaths[0]);
}

/**
 * Parse a PDF file from a known path
 */
export async function parsePdfFromPath(filePath: string): Promise<ParsedPdf> {
    logger.info("Parsing PDF:", filePath);

    const dataBuffer = await fs.readFile(filePath);

    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const pdfParse = require("pdf-parse");
    const data = await pdfParse(dataBuffer);

    const fileName = filePath.split(/[/\\]/).pop() || "unknown.pdf";

    logger.info(`Parsed ${data.numpages} pages, ${data.text.length} chars`);

    return {
        text: data.text,
        pageCount: data.numpages,
        fileName,
        filePath
    };
}

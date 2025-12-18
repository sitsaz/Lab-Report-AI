import * as mammoth from 'mammoth';
import TurndownService from 'turndown';
import * as turndownGfmNamespace from 'turndown-plugin-gfm';
import { 
  Document, 
  Packer, 
  Paragraph, 
  TextRun, 
  HeadingLevel, 
  Table, 
  TableRow, 
  TableCell, 
  BorderStyle, 
  WidthType, 
  ShadingType, 
  VerticalAlign, 
  AlignmentType,
  IStylesOptions
} from 'docx';
import FileSaver from 'file-saver';

/**
 * Extracts text and formatting from a .docx file using mammoth.
 * Uses a fallback strategy to handle environment-specific buffer expectations.
 */
export const extractTextFromDocx = async (file: File): Promise<string> => {
  try {
    console.log(`[DocumentService] Starting extraction: ${file.name} (${file.size} bytes)`);
    
    // 1. Read file as ArrayBuffer
    const arrayBuffer = await file.arrayBuffer();
    if (!arrayBuffer || arrayBuffer.byteLength === 0) {
      throw new Error("The selected file is empty.");
    }

    // 2. Quick magic bytes validation (PK ZIP)
    const view = new Uint8Array(arrayBuffer);
    if (view[0] !== 0x50 || view[1] !== 0x4B || view[2] !== 0x03 || view[3] !== 0x04) {
      if (view[0] === 0xD0 && view[1] === 0xCF && view[2] === 0x11 && view[3] === 0xE0) {
        throw new Error("This is an old .doc file. Please convert it to .docx first.");
      }
      throw new Error("This file is not a valid .docx (ZIP signature missing).");
    }

    // 3. Convert to HTML via mammoth with fallback strategies
    const mammothLib = (mammoth as any).default || mammoth;
    let result;
    
    try {
      console.log("[DocumentService] Attempting mammoth.convertToHtml with arrayBuffer...");
      result = await mammothLib.convertToHtml({ arrayBuffer });
    } catch (firstError: any) {
      console.warn("[DocumentService] Primary extraction failed:", firstError.message);
      
      // Strategy 2: Use polyfilled Buffer if available
      if (typeof window !== 'undefined' && (window as any).Buffer) {
        console.log("[DocumentService] Retrying with Node-style Buffer polyfill...");
        const buf = (window as any).Buffer.from(arrayBuffer);
        result = await mammothLib.convertToHtml({ buffer: buf });
      } else {
        throw firstError;
      }
    }

    if (!result || typeof result.value !== 'string') {
      throw new Error("Mammoth returned an invalid or empty result.");
    }

    const html = result.value;
    console.log(`[DocumentService] HTML conversion successful (${html.length} chars).`);
    
    if (result.messages && result.messages.length > 0) {
      result.messages.forEach((m: any) => console.debug("[Mammoth Msg]", m.message));
    }

    // 4. Convert HTML to Markdown
    const turndownService = new TurndownService({
      headingStyle: 'atx',
      codeBlockStyle: 'fenced',
      emDelimiter: '_',
      strongDelimiter: '**'
    });

    try {
      const ns = turndownGfmNamespace as any;
      const gfmPlugin = ns.gfm || ns.default?.gfm || ns.default || (typeof ns === 'function' ? ns : null);
      if (typeof gfmPlugin === 'function') {
        turndownService.use(gfmPlugin);
      }
    } catch (pluginError) {
      console.warn("[DocumentService] Turndown GFM plugin failed to load:", pluginError);
    }

    const markdown = turndownService.turndown(html);
    return markdown;

  } catch (err: any) {
    console.error("[DocumentService] Critical Extraction Error:", err);
    
    // Provide user-friendly messaging for common failures
    if (err.message && err.message.includes("Could not find main document part")) {
      throw new Error("Invalid .docx structure: This file is corrupted or not a standard Word document. Try opening it in Word or Google Docs and saving it as a fresh .docx file.");
    }
    
    throw err;
  }
};

const docStyles: IStylesOptions = {
  default: {
    document: {
      run: { font: "Calibri", size: 22, color: "000000" },
      paragraph: { spacing: { line: 276, before: 0, after: 120 } },
    },
  },
  paragraphStyles: [
    {
      id: "Heading1",
      name: "Heading 1",
      basedOn: "Normal",
      next: "Normal",
      quickFormat: true,
      run: { size: 32, bold: true, color: "2E74B5", font: "Calibri Light" },
      paragraph: { spacing: { before: 240, after: 120 } },
    },
    {
      id: "Heading2",
      name: "Heading 2",
      basedOn: "Normal",
      next: "Normal",
      quickFormat: true,
      run: { size: 26, bold: true, color: "2E74B5", font: "Calibri Light" },
      paragraph: { spacing: { before: 120, after: 120 } },
    },
  ],
};

const cleanMarkdownText = (text: string): string => {
    if (!text) return "";
    let cleaned = text.replace(/<[^>]*>/g, '');
    cleaned = cleaned
        .replace(/\*\*/g, '')
        .replace(/\*/g, '')
        .replace(/__+/g, '')
        .replace(/~~/g, '')
        .replace(/`+([^`]+)`+/g, '$1')
        .replace(/\[([^\]]+)\]\([^\)]+\)/g, '$1')
        .replace(/\\([*#_|[\]()])/g, '$1');

    return cleaned
        .replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F\uD800-\uDFFF\uFFFE\uFFFF]/g, "")
        .trim();
};

const createTableFromMarkdown = (lines: string[]): Table | null => {
  const contentLines = lines.filter((line, index) => {
    if (index === 1 && line.includes('-') && line.includes('|')) return false;
    return true;
  });

  if (contentLines.length === 0) return null;

  const rows = contentLines.map((line, rowIndex) => {
    const rawCells = line.split('|');
    let cells = rawCells.map(c => c.trim());
    if (cells[0] === '') cells.shift();
    if (cells[cells.length - 1] === '') cells.pop();
    if (cells.length === 0) cells = [" "];
    const isHeader = rowIndex === 0;

    return new TableRow({
      children: cells.map(cellText => 
        new TableCell({
          children: [new Paragraph({ 
            children: [
                new TextRun({
                    text: cleanMarkdownText(cellText) || " ",
                    bold: isHeader,
                    size: isHeader ? 22 : 20,
                    font: "Calibri"
                })
            ],
            alignment: isHeader ? AlignmentType.CENTER : AlignmentType.LEFT
          })],
          shading: { fill: isHeader ? "F2F2F2" : "FFFFFF", type: ShadingType.CLEAR },
          borders: {
            top: { style: BorderStyle.SINGLE, size: 4, color: "A6A6A6" },
            bottom: { style: BorderStyle.SINGLE, size: 4, color: "A6A6A6" },
            left: { style: BorderStyle.SINGLE, size: 4, color: "A6A6A6" },
            right: { style: BorderStyle.SINGLE, size: 4, color: "A6A6A6" },
          },
          verticalAlign: VerticalAlign.CENTER,
          width: { size: Math.max(1, 100 / cells.length), type: WidthType.PERCENTAGE },
          margins: { top: 80, bottom: 80, left: 100, right: 100 }
        })
      ),
    });
  });

  return new Table({
    rows: rows,
    width: { size: 100, type: WidthType.PERCENTAGE },
  });
};

export const saveTextToDocx = async (text: string, filename: string) => {
  if (!text) {
      alert("Cannot export an empty report.");
      return;
  }

  const lines = text.split('\n');
  const children: (Paragraph | Table)[] = [];
  
  let i = 0;
  while (i < lines.length) {
    const line = lines[i].trim();
    if (line === "") {
        children.push(new Paragraph({ children: [new TextRun("")] }));
        i++;
        continue;
    }

    const isTableRow = (l: string) => l.includes('|');
    if (isTableRow(line)) {
        const hasNext = i + 1 < lines.length;
        const nextLine = hasNext ? lines[i+1].trim() : "";
        
        if (hasNext && nextLine.includes('|') && nextLine.match(/^[| \-:]+$/)) {
            const tableLines: string[] = [];
            while (i < lines.length && isTableRow(lines[i])) {
                tableLines.push(lines[i].trim());
                i++;
            }
            if (tableLines.length > 0) {
                try {
                    const tableObj = createTableFromMarkdown(tableLines);
                    if (tableObj) {
                        children.push(tableObj);
                        children.push(new Paragraph({ children: [new TextRun("")] })); 
                    }
                } catch (err) {
                    console.error("Failed to parse table:", err);
                    tableLines.forEach(tl => {
                        children.push(new Paragraph({ children: [new TextRun(cleanMarkdownText(tl))] }));
                    });
                }
            }
            continue;
        }
    }

    const cleanLine = cleanMarkdownText(line);
    if (!cleanLine) {
        i++;
        continue;
    }

    if (line.startsWith('# ')) {
        children.push(new Paragraph({
            text: cleanLine.replace(/^#\s+/, ''),
            heading: HeadingLevel.HEADING_1,
        }));
    } else if (line.startsWith('## ')) {
        children.push(new Paragraph({
            text: cleanLine.replace(/^##\s+/, ''),
            heading: HeadingLevel.HEADING_2,
        }));
    } else if (line.startsWith('### ')) {
        children.push(new Paragraph({
            text: cleanLine.replace(/^###\s+/, ''),
            heading: HeadingLevel.HEADING_3,
        }));
    } else if (line.startsWith('- ') || line.startsWith('* ')) {
        children.push(new Paragraph({
            text: cleanLine.replace(/^[-*]\s+/, ''),
            bullet: { level: 0 },
        }));
    } else {
        children.push(new Paragraph({
            children: [new TextRun({ text: cleanLine })],
        }));
    }
    i++;
  }

  try {
    const doc = new Document({
      styles: docStyles,
      sections: [{
        properties: {},
        children: children.length > 0 ? children : [new Paragraph({ text: "Lab Report Content" })],
      }],
    });

    const blob = await Packer.toBlob(doc);
    const safeFilename = filename.replace(/[<>:"/\\|?*]/g, '_');
    const finalFilename = safeFilename.endsWith('.docx') ? safeFilename : `${safeFilename}.docx`;
    FileSaver.saveAs(blob, finalFilename);
  } catch (error) {
    console.error("Failed to generate .docx blob:", error);
    alert("An error occurred while generating the document.");
  }
};
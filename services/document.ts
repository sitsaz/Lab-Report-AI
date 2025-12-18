
import mammoth from 'mammoth';
import TurndownService from 'turndown';
// @ts-ignore
import { gfm } from 'turndown-plugin-gfm';
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

// Extract text with formatting preserved (Tables, Bold, Lists)
export const extractTextFromDocx = async (file: File): Promise<string> => {
  // Initialize TurndownService inside the function to avoid top-level module execution issues
  const turndownService = new TurndownService({
    headingStyle: 'atx',
    codeBlockStyle: 'fenced',
    emDelimiter: '_',
    strongDelimiter: '**'
  });

  try {
    if (gfm) turndownService.use(gfm);
  } catch (e) {
    console.warn("Turndown GFM plugin failed to load inside extractTextFromDocx", e);
  }

  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = async (event) => {
      try {
        const arrayBuffer = event.target?.result as ArrayBuffer;
        if (!arrayBuffer) {
          reject(new Error("Empty file"));
          return;
        }
        
        // Convert to HTML first to capture structure
        const result = await mammoth.convertToHtml({ arrayBuffer });
        const html = result.value;
        
        // Convert HTML to Markdown (preserving tables via GFM plugin)
        const markdown = turndownService.turndown(html);
        resolve(markdown); 
      } catch (err) {
        reject(err);
      }
    };
    reader.onerror = (err) => reject(err);
    reader.readAsArrayBuffer(file);
  });
};

// Professional Styles Configuration
const docStyles: IStylesOptions = {
  default: {
    document: {
      run: {
        font: "Calibri",
        size: 22, // 11pt
        color: "000000",
      },
      paragraph: {
        spacing: { line: 276, before: 0, after: 120 }, // 1.15 line spacing
      },
    },
  },
  paragraphStyles: [
    {
      id: "Heading1",
      name: "Heading 1",
      basedOn: "Normal",
      next: "Normal",
      quickFormat: true,
      run: {
        size: 32, // 16pt
        bold: true,
        color: "2E74B5",
        font: "Calibri Light",
      },
      paragraph: {
        spacing: { before: 240, after: 120 },
      },
    },
    {
      id: "Heading2",
      name: "Heading 2",
      basedOn: "Normal",
      next: "Normal",
      quickFormat: true,
      run: {
        size: 26, // 13pt
        bold: true,
        color: "2E74B5",
        font: "Calibri Light",
      },
      paragraph: {
        spacing: { before: 120, after: 120 },
      },
    },
  ],
};

const cleanMarkdownText = (text: string): string => {
    return text
        .replace(/\*\*/g, '')
        .replace(/\*/g, '')
        .replace(/\[([^\]]+)\]\([^\)]+\)/g, '$1') // Link cleaning
        .replace(/`([^`]+)`/g, '$1') // Code cleaning
        .trim();
};

const createTableFromMarkdown = (lines: string[]): Table => {
  // Filter out the separator line (| --- | --- |)
  const contentLines = lines.filter((line, index) => {
    if (index === 1 && line.includes('---')) return false;
    return true;
  });

  const rows = contentLines.map((line, rowIndex) => {
    const rawCells = line.split('|');
    // Remove leading and trailing empty cells if the row starts/ends with |
    let cells = rawCells.map(c => c.trim());
    if (cells[0] === '') cells.shift();
    if (cells[cells.length - 1] === '') cells.pop();

    const isHeader = rowIndex === 0;

    return new TableRow({
      children: cells.map(cellText => 
        new TableCell({
          children: [new Paragraph({ 
            children: [
                new TextRun({
                    text: cleanMarkdownText(cellText),
                    bold: isHeader,
                    size: isHeader ? 22 : 20,
                    font: "Calibri"
                })
            ],
            alignment: isHeader ? AlignmentType.CENTER : AlignmentType.LEFT
          })],
          shading: {
            fill: isHeader ? "E7E6E6" : "FFFFFF",
            type: ShadingType.CLEAR,
          },
          borders: {
            top: { style: BorderStyle.SINGLE, size: 4, color: "BFBFBF" },
            bottom: { style: BorderStyle.SINGLE, size: 4, color: "BFBFBF" },
            left: { style: BorderStyle.SINGLE, size: 4, color: "BFBFBF" },
            right: { style: BorderStyle.SINGLE, size: 4, color: "BFBFBF" },
          },
          verticalAlign: VerticalAlign.CENTER,
          width: { size: 100 / (cells.length || 1), type: WidthType.PERCENTAGE },
          margins: { top: 100, bottom: 100, left: 100, right: 100 }
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
  const lines = text.split('\n');
  const children: (Paragraph | Table)[] = [];
  
  let i = 0;
  while (i < lines.length) {
    const line = lines[i].trim();
    
    if (line === "") {
        children.push(new Paragraph({ text: "" }));
        i++;
        continue;
    }

    // Improved Table detection: matches lines starting with | or just containing multiple |
    const isTableRow = (l: string) => l.includes('|') && l.trim().length > 1;
    
    if (isTableRow(line)) {
        const hasNext = i + 1 < lines.length;
        const nextLine = hasNext ? lines[i+1].trim() : "";
        // Check for separator line
        if (hasNext && nextLine.includes('|') && nextLine.includes('---')) {
            const tableLines: string[] = [];
            while (i < lines.length && isTableRow(lines[i])) {
                tableLines.push(lines[i].trim());
                i++;
            }
            if (tableLines.length > 0) {
                try {
                    children.push(createTableFromMarkdown(tableLines));
                    children.push(new Paragraph({ text: "" })); 
                } catch (err) {
                    console.error("Failed to parse table:", err);
                    // Fallback to plain text if table parsing fails
                    tableLines.forEach(tl => {
                        children.push(new Paragraph({ text: tl }));
                    });
                }
            }
            continue;
        }
    }

    // Standard block detection
    if (line.startsWith('# ')) {
        children.push(new Paragraph({
            text: cleanMarkdownText(line.replace('# ', '')),
            heading: HeadingLevel.HEADING_1,
        }));
    } else if (line.startsWith('## ')) {
        children.push(new Paragraph({
            text: cleanMarkdownText(line.replace('## ', '')),
            heading: HeadingLevel.HEADING_2,
        }));
    } else if (line.startsWith('### ')) {
        children.push(new Paragraph({
            text: cleanMarkdownText(line.replace('### ', '')),
            heading: HeadingLevel.HEADING_3,
        }));
    } else if (line.startsWith('- ') || line.startsWith('* ')) {
        children.push(new Paragraph({
            text: cleanMarkdownText(line.substring(2)),
            bullet: { level: 0 },
        }));
    } else {
        const cleanText = cleanMarkdownText(line);
        children.push(new Paragraph({
            children: [new TextRun({ text: cleanText })],
        }));
    }
    
    i++;
  }

  const doc = new Document({
    styles: docStyles,
    sections: [{
      properties: {},
      children: children,
    }],
  });

  const blob = await Packer.toBlob(doc);
  FileSaver.saveAs(blob, filename.endsWith('.docx') ? filename : `${filename}.docx`);
};

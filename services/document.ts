
import mammoth from 'mammoth';
import TurndownService from 'turndown';
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

// Configure Turndown for GFM (tables)
const turndownService = new TurndownService({
  headingStyle: 'atx',
  codeBlockStyle: 'fenced'
});

// Extract text with formatting preserved (Tables, Bold, Lists)
export const extractTextFromDocx = async (file: File): Promise<string> => {
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
        
        // Convert HTML to Markdown (preserving tables if possible via simple regex or turndown)
        // Note: Basic Turndown handles standard HTML tables well.
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

const createTableFromMarkdown = (lines: string[]): Table => {
  const contentLines = lines.filter((line, index) => {
    if (index === 1 && /^[\s|:-]+$/.test(line)) return false;
    return true;
  });

  const rows = contentLines.map((line, rowIndex) => {
    const cells = line.split('|').map(c => c.trim()).filter((c, idx, arr) => {
        // Handle leading/trailing pipes
        if (idx === 0 && c === '') return false;
        if (idx === arr.length - 1 && c === '') return false;
        return true;
    });

    const isHeader = rowIndex === 0;

    return new TableRow({
      children: cells.map(cellText => 
        new TableCell({
          children: [new Paragraph({ 
            children: [
                new TextRun({
                    text: cellText,
                    bold: isHeader,
                    size: isHeader ? 24 : 22,
                })
            ],
            alignment: AlignmentType.CENTER
          })],
          shading: {
            fill: isHeader ? "F2F2F2" : "FFFFFF",
            type: ShadingType.CLEAR,
          },
          borders: {
            top: { style: BorderStyle.SINGLE, size: 1, color: "BFBFBF" },
            bottom: { style: BorderStyle.SINGLE, size: 1, color: "BFBFBF" },
            left: { style: BorderStyle.SINGLE, size: 1, color: "BFBFBF" },
            right: { style: BorderStyle.SINGLE, size: 1, color: "BFBFBF" },
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
    
    // Table detection
    if (line.startsWith('|')) {
        if (i + 1 < lines.length && lines[i+1].trim().startsWith('|') && lines[i+1].includes('---')) {
            const tableLines: string[] = [];
            while (i < lines.length && lines[i].trim().startsWith('|')) {
                tableLines.push(lines[i].trim());
                i++;
            }
            children.push(createTableFromMarkdown(tableLines));
            children.push(new Paragraph({ text: "" })); 
            continue;
        }
    }

    if (line.startsWith('# ')) {
        children.push(new Paragraph({
            text: line.replace('# ', ''),
            heading: HeadingLevel.HEADING_1,
        }));
    } else if (line.startsWith('## ')) {
        children.push(new Paragraph({
            text: line.replace('## ', ''),
            heading: HeadingLevel.HEADING_2,
        }));
    } else if (line.startsWith('### ')) {
        children.push(new Paragraph({
            text: line.replace('### ', ''),
            heading: HeadingLevel.HEADING_3,
        }));
    } else if (line.startsWith('- ') || line.startsWith('* ')) {
        children.push(new Paragraph({
            text: line.substring(2),
            bullet: { level: 0 },
        }));
    } else if (line.trim() !== "") {
        // Clean markdown bold/italic for the Word doc
        const cleanText = line.replace(/\*\*/g, '').replace(/\*/g, '');
        children.push(new Paragraph({
            children: [new TextRun({ text: cleanText })],
        }));
    } else if (line === "") {
        children.push(new Paragraph({ text: "" }));
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

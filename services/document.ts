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
  AlignmentType,
  IStylesOptions,
  VerticalAlign,
  HeightRule,
  TableLayoutType,
  TableCellMargin
} from 'docx';
import FileSaver from 'file-saver';

declare const mammoth: any;

/**
 * Aggressively removes characters that are illegal in XML 1.0.
 * This is crucial for preventing "The file is corrupt" errors in Word.
 */
const sanitizeString = (str: string | undefined | null): string => {
  if (str === null || str === undefined) return " ";
  // Removes control characters except for tab, LF, and CR
  // Also ensures valid Unicode ranges for XML 1.0
  return str.replace(/[^\u0009\u000A\u000D\u0020-\uD7FF\uE000-\uFFFD\u10000-\u10FFFF]/g, '');
};

/**
 * Removes markdown formatting characters for plain-text insertion into Word runs.
 */
const stripMarkdown = (text: string | undefined | null): string => {
  if (!text) return " ";
  return text
    .replace(/[*_~`#]/g, '')
    .replace(/\[([^\]]+)\]\([^\)]+\)/g, '$1') // Simplify links to just text
    .trim() || " ";
};

const getSafeText = (text: string | undefined | null): string => {
  const cleaned = stripMarkdown(text);
  return sanitizeString(cleaned);
};

/**
 * Enhanced Markdown to HTML converter for Google Docs clipboard compatibility.
 */
const markdownToHtmlForGDocs = (markdown: string): string => {
  let html = markdown
    .replace(/^# (.*$)/gim, '<h1 style="color: #2e74b5; font-family: Arial;">$1</h1>')
    .replace(/^## (.*$)/gim, '<h2 style="color: #2e74b5; font-family: Arial;">$1</h2>')
    .replace(/^### (.*$)/gim, '<h3 style="color: #1f4e79; font-family: Arial;">$1</h3>')
    .replace(/\*\*(.*)\*\*/gim, '<b>$1</b>')
    .replace(/\*(.*)\*/gim, '<i>$1</i>')
    .replace(/^- (.*$)/gim, '<ul><li>$1</li></ul>')
    .replace(/<\/ul>\s*<ul>/gim, '') 
    .replace(/\n/gim, '<br />');

  if (html.includes('|')) {
    const lines = html.split('<br />');
    let inTable = false;
    let tableHtml = '<table border="1" style="border-collapse: collapse; width: 100%; font-family: Arial; font-size: 10pt;">';
    
    for (let i = 0; i < lines.length; i++) {
      const line = lines[i].trim();
      if (line.startsWith('|')) {
        if (!inTable) inTable = true;
        const cells = line.split('|').map(c => c.trim()).filter((c, idx, arr) => {
            // Filter out empty ends
            if (idx === 0 && c === '') return false;
            if (idx === arr.length - 1 && c === '') return false;
            return true;
        });
        
        if (line.includes('---') && line.includes('|')) {
          lines[i] = ''; 
          continue; 
        }
        
        tableHtml += '<tr>';
        cells.forEach(cell => {
          tableHtml += `<td style="padding: 6px; border: 1px solid #bfbfbf;">${cell || '&nbsp;'}</td>`;
        });
        tableHtml += '</tr>';
        lines[i] = ''; 
      } else if (inTable) {
        tableHtml += '</table>';
        lines[i] = tableHtml + '<br />' + lines[i];
        inTable = false;
        tableHtml = '';
      }
    }
    if (inTable) tableHtml += '</table>';
    html = lines.filter(l => l !== '').join('<br />') + (inTable ? tableHtml : '');
  }

  return `<div style="font-family: Arial, sans-serif; color: #333; line-height: 1.5;">${html}</div>`;
};

export const copyForGoogleDocs = async (markdown: string): Promise<boolean> => {
  try {
    const html = markdownToHtmlForGDocs(markdown);
    const blobHtml = new Blob([html], { type: 'text/html' });
    const blobText = new Blob([markdown], { type: 'text/plain' });
    
    const data = [new ClipboardItem({
      'text/html': blobHtml,
      'text/plain': blobText,
    })];

    await navigator.clipboard.write(data);
    return true;
  } catch (err) {
    console.error("Clipboard export failed:", err);
    return false;
  }
};

export const extractTextFromDocx = async (file: File): Promise<string> => {
  try {
    const arrayBuffer = await file.arrayBuffer();
    if (!arrayBuffer || arrayBuffer.byteLength === 0) throw new Error("File is empty.");
    const mammothInstance = (window as any).mammoth || mammoth;
    if (!mammothInstance) throw new Error("Mammoth parser not found.");
    const result = await mammothInstance.convertToHtml({ arrayBuffer });
    const turndownService = new TurndownService({ headingStyle: 'atx', codeBlockStyle: 'fenced' });
    try {
      const ns = turndownGfmNamespace as any;
      const gfm = ns.gfm || ns.default?.gfm || ns.default;
      if (typeof gfm === 'function') turndownService.use(gfm);
    } catch (e) {}
    return turndownService.turndown(result.value);
  } catch (err: any) {
    throw new Error(err.message || "Extraction failed.");
  }
};

const docStyles: IStylesOptions = {
  default: {
    heading1: {
      run: { size: 32, bold: true, color: "2E74B5", font: "Calibri" },
      paragraph: { spacing: { before: 240, after: 120 } },
    },
    heading2: {
      run: { size: 26, bold: true, color: "2E74B5", font: "Calibri" },
      paragraph: { spacing: { before: 120, after: 120 } },
    },
    document: {
      run: { font: "Calibri", size: 22 },
      paragraph: { spacing: { line: 276, before: 0, after: 120 } },
    },
  },
};

/**
 * Robust Markdown table parser for Word.
 * Ensures consistent column counts and valid OOXML structure.
 */
const parseMarkdownTableToDocx = (lines: string[]): Table | null => {
  // 1. Clean data lines and remove the separator row (|---|---|)
  const dataLines = lines.filter((line, index) => {
    const trimmed = line.trim();
    if (index === 1 && trimmed.includes('-') && trimmed.includes('|')) return false;
    return trimmed.length > 0;
  });

  if (dataLines.length === 0) return null;

  // 2. Extract cells more robustly
  const rawRows = dataLines.map(line => {
    const rawCells = line.split('|').map(c => c.trim());
    // Remove the empty elements caused by leading/trailing pipes
    if (rawCells[0] === '') rawCells.shift();
    if (rawCells[rawCells.length - 1] === '') rawCells.pop();
    return rawCells;
  });

  const maxCols = Math.max(...rawRows.map(r => r.length));
  if (maxCols === 0) return null;

  // 3. Build TableRows with balanced cells and proper margins
  const tableRows = rawRows.map((cells, rowIndex) => {
    const isHeader = rowIndex === 0;
    const balancedCells = [...cells];
    while (balancedCells.length < maxCols) balancedCells.push(" ");

    return new TableRow({
      children: balancedCells.map(cellText => {
        const safeContent = getSafeText(cellText);
        return new TableCell({
          children: [
            new Paragraph({
              children: [
                new TextRun({ 
                  text: safeContent || " ", // Guaranteed non-empty for Word stability
                  bold: isHeader, 
                  size: isHeader ? 22 : 20 
                })
              ],
              alignment: isHeader ? AlignmentType.CENTER : AlignmentType.LEFT,
              spacing: { before: 100, after: 100 }
            })
          ],
          shading: { fill: isHeader ? "F2F2F2" : "FFFFFF" },
          verticalAlign: VerticalAlign.CENTER,
          margins: {
            top: 100,
            bottom: 100,
            left: 100,
            right: 100,
          },
          borders: {
            top: { style: BorderStyle.SINGLE, size: 1, color: "BFBFBF" },
            bottom: { style: BorderStyle.SINGLE, size: 1, color: "BFBFBF" },
            left: { style: BorderStyle.SINGLE, size: 1, color: "BFBFBF" },
            right: { style: BorderStyle.SINGLE, size: 1, color: "BFBFBF" },
          },
          width: { size: 100 / maxCols, type: WidthType.PERCENTAGE },
        });
      }),
    });
  });

  return new Table({
    rows: tableRows,
    width: { size: 100, type: WidthType.PERCENTAGE },
    layout: TableLayoutType.FIXED,
    borders: {
      top: { style: BorderStyle.SINGLE, size: 2, color: "777777" },
      bottom: { style: BorderStyle.SINGLE, size: 2, color: "777777" },
      left: { style: BorderStyle.SINGLE, size: 2, color: "777777" },
      right: { style: BorderStyle.SINGLE, size: 2, color: "777777" },
      insideHorizontal: { style: BorderStyle.SINGLE, size: 1, color: "BFBFBF" },
      insideVertical: { style: BorderStyle.SINGLE, size: 1, color: "BFBFBF" },
    }
  });
};

export const saveTextToDocx = async (text: string, filename: string) => {
  const lines = text.split(/\r?\n/);
  const children: (Paragraph | Table)[] = [];
  let i = 0;

  while (i < lines.length) {
    const line = lines[i].trim();
    
    // 1. Handle Empty Lines
    if (!line) {
      children.push(new Paragraph({ 
        children: [new TextRun("")],
        spacing: { after: 120 }
      }));
      i++;
      continue;
    }

    // 2. Handle Tables
    // Look for a markdown table start
    if (line.startsWith('|') && i + 1 < lines.length && lines[i+1].includes('|') && lines[i+1].includes('-')) {
      const tableLines: string[] = [];
      while (i < lines.length && lines[i].trim().startsWith('|')) {
        tableLines.push(lines[i].trim());
        i++;
      }
      const table = parseMarkdownTableToDocx(tableLines);
      if (table) {
        children.push(table);
        // Add a blank paragraph for spacing after the table
        children.push(new Paragraph({ children: [new TextRun("")] }));
      }
      continue;
    }

    // 3. Handle Headings
    if (line.startsWith('# ')) {
      children.push(new Paragraph({ 
        children: [new TextRun({ text: sanitizeString(line.replace(/^#\s+/, '')) })], 
        heading: HeadingLevel.HEADING_1 
      }));
    } else if (line.startsWith('## ')) {
      children.push(new Paragraph({ 
        children: [new TextRun({ text: sanitizeString(line.replace(/^##\s+/, '')) })], 
        heading: HeadingLevel.HEADING_2 
      }));
    } else if (line.startsWith('### ')) {
      children.push(new Paragraph({ 
        children: [new TextRun({ text: sanitizeString(line.replace(/^###\s+/, '')) })], 
        heading: HeadingLevel.HEADING_3 
      }));
    } 
    // 4. Handle Lists
    else if (line.startsWith('- ') || line.startsWith('* ')) {
      children.push(new Paragraph({ 
        children: [new TextRun({ text: getSafeText(line.substring(2)) })], 
        bullet: { level: 0 } 
      }));
    } 
    // 5. Normal text
    else {
      children.push(new Paragraph({ 
        children: [new TextRun({ text: getSafeText(line) })] 
      }));
    }
    i++;
  }

  try {
    const doc = new Document({
      styles: docStyles,
      sections: [{
        properties: { 
          page: { margin: { top: 1440, right: 1440, bottom: 1440, left: 1440 } } 
        },
        children: children.length > 0 ? children : [new Paragraph({ children: [new TextRun(" ")] })],
      }],
    });

    const blob = await Packer.toBlob(doc);
    const safeName = filename.replace(/[<>:"/\\|?*]/g, '_').replace(/\.docx$/, '') + ".docx";
    FileSaver.saveAs(blob, safeName);
  } catch (err) {
    console.error("DOCX Export Error:", err);
    alert("Export Failed: An error occurred while building the Word document. Please check the console for details.");
  }
};

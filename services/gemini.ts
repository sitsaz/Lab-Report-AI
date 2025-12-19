import { GoogleGenAI, Type, FunctionDeclaration } from "@google/genai";
import { Message } from "../types";

const SYSTEM_INSTRUCTION = `
You are an expert Lab Report Assistant. Your goal is to help students and researchers write, complete, and improve their lab reports in .docx format.

**CORE CAPABILITIES**
1. **Document Context**: You have access to the user's current report content.
2. **Google Search (Research)**: You MUST use the \`googleSearch\` tool to find scientific constants, verify theories, or check experimental methods.
3. **Direct Updates**: You can \`update_report\` to modify the text directly.

**STRICT RESOLUTION PROTOCOL (MANDATORY)**
When the user provides a "RESOLUTION MANIFEST" or specific choices for conflicts:
1. **Tool Execution**: You MUST call \`update_report\` for EVERY conflict marked as 'OVERWRITE' or 'COMBINE'. 
2. **Atomic Updates**: If there are multiple resolutions, make multiple \`update_report\` calls in a single turn.
3. **Search Accuracy**: The \`search_text\` MUST be an EXACT substring from the provided [CURRENT REPORT CONTENT]. Do not paraphrase the text you are searching for.
4. **Implementation Logic**:
   - 'OVERWRITE': Replace the old text with the new input provided.
   - 'COMBINE': Synthesize a professional scientific paragraph that integrates both pieces of data logically.
5. **Confirmation**: Only after calling the tools, provide a brief summary of what was changed.

**CONFLICT DETECTION**
- Continuously scan new user inputs against the report.
- Call \`report_conflict\` for discrepancies. Stop and wait for user choice.

**TONE**
Academic, precise, professional.
`;

const conflictToolDeclaration: FunctionDeclaration = {
  name: "report_conflict",
  parameters: {
    type: Type.OBJECT,
    properties: {
      existing_info: {
        type: Type.STRING,
        description: "The specific fact or text currently in the report that conflicts.",
      },
      new_info: {
        type: Type.STRING,
        description: "The new conflicting information provided by the user.",
      },
      description: {
        type: Type.STRING,
        description: "A brief 1-sentence explanation of the conflict.",
      },
      reasoning: {
        type: Type.STRING,
        description: "A detailed explanation of why this is a conflict.",
      },
    },
    required: ["existing_info", "new_info", "description", "reasoning"],
  },
  description: "Call this tool to report a data discrepancy that requires user resolution.",
};

const updateReportToolDeclaration: FunctionDeclaration = {
  name: "update_report",
  parameters: {
    type: Type.OBJECT,
    properties: {
      search_text: {
        type: Type.STRING,
        description: "The EXACT sequence of characters currently in the report to be replaced. Must be an exact match.",
      },
      replacement_text: {
        type: Type.STRING,
        description: "The new content to insert in place of the search_text.",
      },
    },
    required: ["search_text", "replacement_text"],
  },
  description: "Replaces specific text in the report. Crucial for applying conflict resolutions.",
};

const citationToolDeclaration: FunctionDeclaration = {
  name: "add_citation",
  parameters: {
    type: Type.OBJECT,
    properties: {
      source: {
        type: Type.STRING,
        description: "URL or Title of the source.",
      },
    },
    required: ["source"],
  },
  description: "Adds a source to the bibliography.",
};

export interface UpdateReportAction {
    search_text: string;
    replacement_text: string;
}

export class GeminiError extends Error {
  constructor(public message: string, public isQuotaError: boolean = false) {
    super(message);
    this.name = 'GeminiError';
  }
}

async function withRetry<T>(fn: () => Promise<T>, maxRetries = 3, initialDelay = 1000): Promise<T> {
  let lastError: any;
  for (let i = 0; i < maxRetries; i++) {
    try {
      return await fn();
    } catch (error: any) {
      lastError = error;
      const isQuota = error?.message?.includes('RESOURCE_EXHAUSTED') || error?.status === 429;
      if (isQuota && i === maxRetries - 1) {
        throw new GeminiError("API Quota exceeded. Please try again later or select a different API key.", true);
      }
      if (i < maxRetries - 1) {
        const delay = initialDelay * Math.pow(2, i);
        await new Promise(resolve => setTimeout(resolve, delay));
      }
    }
  }
  throw lastError;
}

export const sendMessageToGemini = async (
  currentReportText: string,
  chatHistory: Message[],
  userPrompt: string,
  language: 'en' | 'fa' = 'en'
): Promise<{ 
    text: string; 
    sources?: { title?: string; uri: string }[]; 
    conflicts?: any[]; 
    newCitations?: string[];
    reportUpdates?: UpdateReportAction[];
    usage?: any;
}> => {
  return withRetry(async () => {
    const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
    const recentHistory = chatHistory.slice(-15).map((msg) => ({
      role: msg.role as "user" | "model",
      parts: [{ text: msg.text || (msg.conflict ? `Conflict Report: ${msg.conflict.description}` : "Applying resolution updates...") }],
    }));
    const langContext = language === 'fa' ? 'User is using Persian. Respond in Persian, but keep technical/scientific names accurate.' : '';
    const augmentedPrompt = `\n${langContext}\n\n[CURRENT REPORT CONTENT]\n${currentReportText}\n\n[USER INPUT / RESOLUTION REQUEST]\n${userPrompt}\n`;

    const response = await ai.models.generateContent({
      model: "gemini-3-flash-preview",
      contents: [...recentHistory, { role: "user", parts: [{ text: augmentedPrompt }] }],
      config: {
        systemInstruction: SYSTEM_INSTRUCTION,
        tools: [{ googleSearch: {} }, { functionDeclarations: [conflictToolDeclaration, citationToolDeclaration, updateReportToolDeclaration] }],
      },
    });

    let text = response.text || "";
    const conflicts: any[] = [];
    const reportUpdates: UpdateReportAction[] = [];
    const newCitations: string[] = [];
    const functionCalls = response.functionCalls;
    if (functionCalls && functionCalls.length > 0) {
      functionCalls.forEach(call => {
        if (call.name === 'report_conflict') conflicts.push(call.args);
        if (call.name === 'update_report') reportUpdates.push(call.args as unknown as UpdateReportAction);
        if (call.name === 'add_citation') {
           const args = call.args as any;
           if (args.source) newCitations.push(args.source);
        }
      });
      if (reportUpdates.length > 0 && !text) {
          text = language === 'fa' ? "گزارش با تغییرات جدید به‌روزرسانی شد." : "Report updated successfully.";
      }
    }
    const chunks = response.candidates?.[0]?.groundingMetadata?.groundingChunks;
    const sources = chunks?.map((chunk) => chunk.web).filter((web) => !!web).map((web) => ({ title: web.title, uri: web.uri }));
    return { text, sources, conflicts, newCitations, reportUpdates, usage: response.usageMetadata };
  });
};

export const generateCitation = async (
  source: string,
  style: 'APA' | 'IEEE' | 'MLA' = 'APA'
): Promise<{ formatted: string; inText: string; usage?: any }> => {
  return withRetry(async () => {
    const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
    const prompt = `Cite: "${source}" style: ${style}. Return JSON: {formatted, inText}`;
    const response = await ai.models.generateContent({
      model: "gemini-3-flash-preview",
      contents: [{ role: "user", parts: [{ text: prompt }] }],
      config: { responseMimeType: "application/json" }
    });
    const json = JSON.parse(response.text || "{}");
    return { formatted: json.formatted || source, inText: json.inText || `[1]`, usage: response.usageMetadata };
  });
};
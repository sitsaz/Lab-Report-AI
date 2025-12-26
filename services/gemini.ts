
import { GoogleGenAI, Type, FunctionDeclaration } from "@google/genai";
import { Message } from "../types";

const SYSTEM_INSTRUCTION = `
You are an expert Lab Report Assistant. Your goal is to help students and researchers write, complete, and improve their lab reports in .docx format.

**CORE CAPABILITIES**
1. **Document Context**: You have access to the user's current report content.
2. **Google Search (Research)**: You MUST use the \`googleSearch\` tool to find scientific constants, verify theories, find recent academic papers, or check experimental methods. **Do not guess scientific data.**
3. **Direct Updates**: You can \`update_report\` to modify the text directly.

**STRICT RESEARCH & CITATION PROTOCOL**
1. **Aggressive Search**: When the user asks for facts or background theory, ALWAYS use \`googleSearch\`.
2. **Cite Sources**: Automatically call \`add_citation\` when you find useful scientific info.
3. **In-Text Markers**: Include academic markers like (Author, Year) or [1] where relevant.

**CONFLICT DETECTION PROTOCOL**
- Scan [NEW INPUT] against [CURRENT REPORT] for discrepancies in numbers, facts, or methods.
- Call \`report_conflict\` for each specific discrepancy.
- Stop and wait for user resolution before modifying the report in the conflicting areas.

**SOPHISTICATED SCIENTIFIC MERGING (For "COMBINE" resolution)**
When a user selects "COMBINE" for a conflict, you MUST NOT simply append text. You must perform an AI-driven synthesis:
- **Logical Integration**: Create a cohesive sentence or paragraph that explains the relationship between the two data points.
- **Contextual Anchoring**: "Initially, the report recorded [Data A]. However, subsequent analysis/new inputs suggest [Data B], indicating a shift in [Variable]."
- **Error Analysis**: If values differ, suggest a merge that mentions the range or the most recent finding: "The measured value of [Variable] is [Data B] (refined from previous estimate of [Data A])."
- **Scientific Synthesis**: Use transition words like "concurrently," "notwithstanding," or "subsequently" to bridge the data.
- **Academic Standard**: The final text must read like a professional scientific paper, not a chat log.

**RESOLUTION EXECUTION**
Once the user submits their choices:
1. **Apply Resolutions**: You MUST call \`update_report\` for EVERY 'OVERWRITE' and 'COMBINE' choice provided in the resolution manifest.
2. **Multiple Calls**: If there are 3 conflicts to resolve, you must make 3 separate \`update_report\` calls in this single response.
3. **Finish the Job**: After applying updates, complete the rest of the user's original request using the updated facts.

**TONE**
Academic, precise, helpful. Use Markdown for clear formatting.
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
        description: "A detailed explanation of the conflict and its impact.",
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
        description: "The EXACT text sequence in the current report to be replaced. Must match character-for-character, including spaces and punctuation.",
      },
      replacement_text: {
        type: Type.STRING,
        description: "The new text. For COMBINED resolutions, this MUST be the full merged/rewritten scientific text.",
      },
    },
    required: ["search_text", "replacement_text"],
  },
  description: "Replaces a specific section of the report text with new content. Can be called multiple times.",
};

const citationToolDeclaration: FunctionDeclaration = {
  name: "add_citation",
  parameters: {
    type: Type.OBJECT,
    properties: {
      source: {
        type: Type.STRING,
        description: "The URL or Title of the source to add to citations.",
      },
    },
    required: ["source"],
  },
  description: "Adds a source to the report's bibliography list.",
};

export interface UpdateReportAction {
    search_text: string;
    replacement_text: string;
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
  // Always initialize right before use to ensure process.env.API_KEY is available and correct
  const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });

  const recentHistory = chatHistory.slice(-10).map((msg) => ({
    role: msg.role as "user" | "model",
    parts: [{ text: msg.text || (msg.conflict ? `Conflict Resolution: ${msg.conflict.description}` : "") }],
  }));

  const langContext = language === 'fa' 
    ? 'The user is using the Persian interface. Communicate in Persian (Farsi) while keeping scientific terms accurate.'
    : '';

  const augmentedPrompt = `
${langContext}

[CURRENT REPORT CONTENT START]
${currentReportText}
[CURRENT REPORT CONTENT END]

[USER REQUEST / RESOLUTION MANIFEST]
${userPrompt}
`;

  try {
    const response = await ai.models.generateContent({
      model: "gemini-3-flash-preview",
      contents: [
        ...recentHistory,
        { role: "user", parts: [{ text: augmentedPrompt }] },
      ],
      config: {
        systemInstruction: SYSTEM_INSTRUCTION,
        tools: [
            { googleSearch: {} },
            { functionDeclarations: [conflictToolDeclaration, citationToolDeclaration, updateReportToolDeclaration] }
        ],
      },
    });

    let text = response.text || "";
    const conflicts: any[] = [];
    const reportUpdates: UpdateReportAction[] = [];
    const newCitations: string[] = [];

    const functionCalls = response.functionCalls;
    if (functionCalls && functionCalls.length > 0) {
      
      // Collect all conflicts
      functionCalls.filter(c => c.name === 'report_conflict').forEach(call => {
          conflicts.push(call.args);
      });
      
      // Collect all updates (Handling multiple calls)
      functionCalls.filter(c => c.name === 'update_report').forEach(call => {
          reportUpdates.push(call.args as unknown as UpdateReportAction);
      });

      // Collect citations
      functionCalls.filter(c => c.name === 'add_citation').forEach(call => {
         const args = call.args as any;
         if (args.source) newCitations.push(args.source);
      });

      // Provide feedback text if the AI just called tools silently
      if (reportUpdates.length > 0 && !text) {
          text = language === 'fa' 
            ? `گزارش با ${reportUpdates.length} مورد تغییر به‌روزرسانی شد.` 
            : `Report updated with ${reportUpdates.length} changes.`;
      } else if (conflicts.length > 0 && !text) {
          text = language === 'fa' 
            ? "تضادهایی در داده‌ها مشاهده شد. لطفاً در برگه «تضادها» نحوه مدیریت آن‌ها را مشخص کنید." 
            : "Data conflicts detected. Please resolve them in the 'Conflicts' tab.";
      }
    }

    const chunks = response.candidates?.[0]?.groundingMetadata?.groundingChunks;
    const sources = chunks
      ?.map((chunk) => chunk.web)
      .filter((web) => web !== undefined && web !== null)
      .map((web) => ({ title: web.title, uri: web.uri }));

    return { text, sources, conflicts, newCitations, reportUpdates, usage: response.usageMetadata };
  } catch (error) {
    console.error("Gemini API Error:", error);
    throw new Error("Failed to communicate with AI Assistant.");
  }
};

export const generateCitation = async (
  source: string,
  style: 'APA' | 'IEEE' | 'MLA' = 'APA'
): Promise<{ formatted: string; inText: string; usage?: any }> => {
  const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
  const prompt = `Generate academic citation for: "${source}" style: ${style}. Return a JSON object with "formatted" and "inText" properties.`;

  try {
    const response = await ai.models.generateContent({
      model: "gemini-3-flash-preview",
      contents: [{ role: "user", parts: [{ text: prompt }] }],
      config: { 
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            formatted: { type: Type.STRING },
            inText: { type: Type.STRING },
          },
          required: ["formatted", "inText"],
        }
      }
    });
    const json = JSON.parse(response.text || "{}");
    return { 
      formatted: json.formatted || source, 
      inText: json.inText || `[source]`,
      usage: response.usageMetadata
    };
  } catch (error) {
    return { formatted: source, inText: `[?]` };
  }
};

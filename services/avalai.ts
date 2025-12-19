
import { Message } from "../types";
import { UpdateReportAction } from "./gemini";

// Base URL as per AvalAI documentation: https://docs.avalai.ir/fa/api-reference/introduction
const AVALAI_API_URL = "https://api.avalai.ir/v1/chat/completions";

const SYSTEM_PROMPT = `You are a professional Lab Report Assistant powered by AvalAI. 
Your goal is to help researchers and students improve their scientific documentation.
You have access to the current report content. 

CAPABILITIES:
1. Detect data conflicts: use 'report_conflict'.
2. Direct document editing: use 'update_report'.
3. Academic citations: use 'add_citation'.

REPLACE Protocol:
- 'update_report' MUST be used for text changes.
- 'search_text' must be a verbatim, exact substring from the report.

Response Tone: Objective, precise, and academic.`;

const TOOLS = [
  {
    type: "function",
    function: {
      name: "report_conflict",
      description: "Report a discrepancy between experimental data and established scientific values.",
      parameters: {
        type: "object",
        properties: {
          existing_info: { type: "string", description: "The conflicting text currently in the report." },
          new_info: { type: "string", description: "The new data or fact that contradicts it." },
          description: { type: "string", description: "A concise summary of the conflict." },
          reasoning: { type: "string", description: "Scientific explanation of why this is a conflict." }
        },
        required: ["existing_info", "new_info", "description", "reasoning"]
      }
    }
  },
  {
    type: "function",
    function: {
      name: "update_report",
      description: "Applies specific text replacements to the laboratory report.",
      parameters: {
        type: "object",
        properties: {
          search_text: { type: "string", description: "The exact string to find in the document." },
          replacement_text: { type: "string", description: "The new content to insert." }
        },
        required: ["search_text", "replacement_text"]
      }
    }
  }
];

export const sendMessageToAvalAI = async (
  currentReportText: string,
  chatHistory: Message[],
  userPrompt: string,
  apiKey: string = process.env.API_KEY || "",
  model: string = "gpt-4o"
): Promise<any> => {
  if (!apiKey) {
    throw new Error("API Key is missing for AvalAI.");
  }

  const messages = [
    { role: "system", content: SYSTEM_PROMPT },
    ...chatHistory.map(m => ({ 
        role: m.role === 'model' ? 'assistant' : 'user', 
        content: m.text || "Synchronizing document state..." 
    })),
    { role: "user", content: `[CURRENT REPORT CONTENT]\n${currentReportText}\n\n[USER INSTRUCTION]\n${userPrompt}` }
  ];

  const response = await fetch(AVALAI_API_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "Authorization": `Bearer ${apiKey}`
    },
    body: JSON.stringify({
      model: model, 
      messages,
      tools: TOOLS,
      tool_choice: "auto",
      stream: false
    })
  });

  if (!response.ok) {
    let errorMessage = "AvalAI request failed";
    try {
      const errorData = await response.json();
      errorMessage = errorData.error?.message || errorMessage;
    } catch (e) {
      errorMessage = `HTTP error ${response.status}`;
    }
    throw new Error(errorMessage);
  }

  const data = await response.json();
  const choice = data.choices[0].message;
  
  const conflicts: any[] = [];
  const reportUpdates: UpdateReportAction[] = [];
  
  if (choice.tool_calls) {
    choice.tool_calls.forEach((call: any) => {
      try {
        const args = JSON.parse(call.function.arguments);
        if (call.function.name === 'report_conflict') conflicts.push(args);
        if (call.function.name === 'update_report') reportUpdates.push(args);
      } catch (e) {
        console.error("Failed to parse AvalAI tool arguments", e);
      }
    });
  }

  return {
    text: choice.content || (reportUpdates.length > 0 ? "Modifying report structure..." : ""),
    conflicts,
    reportUpdates,
    usage: { totalTokenCount: data.usage?.total_tokens || 0 }
  };
};


import { Message } from "../types";
import { UpdateReportAction } from "./gemini";

const OPENAI_API_URL = "https://api.openai.com/v1/chat/completions";

const SYSTEM_PROMPT = `You are an expert Lab Report Assistant. Your goal is to help write and improve lab reports.
You have access to the current report content. 
If you find conflicts in data, use 'report_conflict'. 
To change text, use 'update_report'.
To add a citation, use 'add_citation'.

REPLACE Protocol:
- 'update_report' MUST be used to apply changes.
- 'search_text' must be an EXACT substring.

Tone: Academic, professional.`;

const TOOLS = [
  {
    type: "function",
    function: {
      name: "report_conflict",
      description: "Report a data discrepancy that requires user resolution.",
      parameters: {
        type: "object",
        properties: {
          existing_info: { type: "string", description: "The text currently in the report." },
          new_info: { type: "string", description: "The new conflicting data." },
          description: { type: "string", description: "1-sentence summary." },
          reasoning: { type: "string", description: "Why is this a conflict?" }
        },
        required: ["existing_info", "new_info", "description", "reasoning"]
      }
    }
  },
  {
    type: "function",
    function: {
      name: "update_report",
      description: "Replaces specific text in the report.",
      parameters: {
        type: "object",
        properties: {
          search_text: { type: "string", description: "Exact text to find." },
          replacement_text: { type: "string", description: "Text to insert." }
        },
        required: ["search_text", "replacement_text"]
      }
    }
  }
];

export const sendMessageToOpenAI = async (
  currentReportText: string,
  chatHistory: Message[],
  userPrompt: string,
  apiKey: string = process.env.API_KEY || "",
  model: string = "gpt-4o"
): Promise<any> => {
  const messages = [
    { role: "system", content: SYSTEM_PROMPT },
    ...chatHistory.map(m => ({ 
        role: m.role === 'model' ? 'assistant' : 'user', 
        content: m.text || "Handling document tools..." 
    })),
    { role: "user", content: `[CURRENT REPORT]\n${currentReportText}\n\n[USER INPUT]\n${userPrompt}` }
  ];

  const response = await fetch(OPENAI_API_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "Authorization": `Bearer ${apiKey}`
    },
    body: JSON.stringify({
      model: model,
      messages,
      tools: TOOLS,
      tool_choice: "auto"
    })
  });

  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.error?.message || "OpenAI API Error");
  }

  const data = await response.json();
  const choice = data.choices[0].message;
  
  const conflicts: any[] = [];
  const reportUpdates: UpdateReportAction[] = [];
  
  if (choice.tool_calls) {
    choice.tool_calls.forEach((call: any) => {
      const args = JSON.parse(call.function.arguments);
      if (call.function.name === 'report_conflict') conflicts.push(args);
      if (call.function.name === 'update_report') reportUpdates.push(args);
    });
  }

  return {
    text: choice.content || (reportUpdates.length > 0 ? "Report updated." : ""),
    conflicts,
    reportUpdates,
    usage: { totalTokenCount: data.usage.total_tokens }
  };
};

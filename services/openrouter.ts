
import { Message } from "../types";
import { UpdateReportAction } from "./gemini";

const OPENROUTER_API_URL = "https://openrouter.ai/api/v1/chat/completions";

export const sendMessageToOpenRouter = async (
  currentReportText: string,
  chatHistory: Message[],
  userPrompt: string,
  apiKey: string = process.env.API_KEY || "",
  model: string = "anthropic/claude-3.5-sonnet"
): Promise<any> => {
  const messages = [
    { role: "system", content: "You are an expert lab report assistant. Use tool calls to update reports and report conflicts." },
    ...chatHistory.map(m => ({ role: m.role === 'model' ? 'assistant' : 'user', content: m.text || "Tool operation..." })),
    { role: "user", content: `[REPORT]\n${currentReportText}\n\n[INPUT]\n${userPrompt}` }
  ];

  const response = await fetch(OPENROUTER_API_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "Authorization": `Bearer ${apiKey}`,
      "HTTP-Referer": window.location.origin,
      "X-Title": "LabReportAI"
    },
    body: JSON.stringify({
      model: model,
      messages,
      tools: [
        {
          type: "function",
          function: {
            name: "update_report",
            description: "Update the report content.",
            parameters: {
              type: "object",
              properties: {
                search_text: { type: "string" },
                replacement_text: { type: "string" }
              }
            }
          }
        },
        {
          type: "function",
          function: {
            name: "report_conflict",
            description: "Notify about data conflicts.",
            parameters: {
              type: "object",
              properties: {
                existing_info: { type: "string" },
                new_info: { type: "string" },
                description: { type: "string" },
                reasoning: { type: "string" }
              }
            }
          }
        }
      ]
    })
  });

  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.error?.message || "OpenRouter API Error");
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
    text: choice.content || (reportUpdates.length > 0 ? "Changes applied via AI." : ""),
    conflicts,
    reportUpdates,
    usage: { totalTokenCount: data.usage?.total_tokens || 0 }
  };
};

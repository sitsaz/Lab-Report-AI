
import { Message } from '../types';

export const sendMessageToOpenRouter = async (
  currentContent: string,
  history: Message[],
  prompt: string,
  apiKey: string,
  model: string
) => {
  console.warn("OpenRouter provider not fully implemented in this stub.");
  return {
    text: "OpenRouter provider is currently under development.",
    usage: { totalTokenCount: 0 }
  };
};

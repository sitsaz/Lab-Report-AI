
import { Message } from '../types';

export const sendMessageToOpenAI = async (
  currentContent: string,
  history: Message[],
  prompt: string,
  apiKey: string,
  model: string
) => {
  console.warn("OpenAI provider not fully implemented in this stub.");
  return {
    text: "OpenAI provider is currently under development.",
    usage: { totalTokenCount: 0 }
  };
};

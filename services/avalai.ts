
import { Message } from '../types';

export const sendMessageToAvalAI = async (
  currentContent: string,
  history: Message[],
  prompt: string,
  apiKey: string,
  model: string
) => {
  console.warn("AvalAI provider not fully implemented in this stub.");
  return {
    text: "AvalAI provider is currently under development.",
    usage: { totalTokenCount: 0 }
  };
};

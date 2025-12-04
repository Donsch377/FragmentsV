export type ChatResponseMode = "short" | "long";

type ChatResponseSetting = {
  key: ChatResponseMode;
  label: string;
  description: string;
  maxTokens: number;
  suggestedWordCount: number;
};

export const CHAT_RESPONSE_MODES: Record<ChatResponseMode, ChatResponseSetting> = {
  short: {
    key: "short",
    label: "Short answers",
    description: "Quick tips and 2–3 sentence responses.",
    maxTokens: 256,
    suggestedWordCount: 120,
  },
  long: {
    key: "long",
    label: "Detailed answers",
    description: "Full walkthroughs and richer context.",
    maxTokens: 1024,
    suggestedWordCount: 320,
  },
};

export const DEFAULT_CHAT_RESPONSE_MODE: ChatResponseMode = "long";

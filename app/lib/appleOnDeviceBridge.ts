import { Platform } from "react-native";

export type AppleBridgeMessage = {
  role: "system" | "user" | "assistant";
  content: string;
};

export class AppleOnDeviceError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "AppleOnDeviceError";
  }
}

const APPLE_ENDPOINT = process.env.EXPO_PUBLIC_APPLE_LLM_URL ?? "http://127.0.0.1:17890/v1/chat/completions";
const APPLE_MODEL = process.env.EXPO_PUBLIC_APPLE_LLM_MODEL ?? "apple-intelligence-preview";
const CONTEXT_WINDOW = 4096;

const ensureAppleSupport = () => {
  if (Platform.OS !== "ios") {
    throw new AppleOnDeviceError("Apple Intelligence is only available on iOS hardware.");
  }
};

const sanitizeMessages = (messages: AppleBridgeMessage[]) =>
  messages.map((message) => ({
    role: message.role,
    content: message.content,
  }));

export const runAppleOnDeviceBridge = async ({
  messages,
  signal,
  maxOutputTokens,
}: {
  messages: AppleBridgeMessage[];
  signal?: AbortSignal;
  maxOutputTokens?: number;
}) => {
  ensureAppleSupport();
  if (!messages.length) {
    throw new AppleOnDeviceError("Apple on-device bridge requires at least one message.");
  }
  const response = await fetch(APPLE_ENDPOINT, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      model: APPLE_MODEL,
      messages: sanitizeMessages(messages),
      max_output_tokens: maxOutputTokens ?? 800,
      temperature: 0.2,
      context_window: CONTEXT_WINDOW,
    }),
    signal,
  });
  if (!response.ok) {
    throw new AppleOnDeviceError(`Apple on-device bridge failed (${response.status}).`);
  }
  const data = await response.json();
  const text =
    data?.choices?.[0]?.message?.content ??
    data?.output?.content ??
    data?.message ??
    "";
  if (!text) {
    throw new AppleOnDeviceError("Apple on-device bridge returned an empty response.");
  }
  const finishReason = data?.choices?.[0]?.finish_reason ?? data?.finish_reason ?? null;
  return { text, raw: data, finishReason };
};

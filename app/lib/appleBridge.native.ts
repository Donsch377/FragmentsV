import { NativeModules, Platform } from "react-native";

const LINKING_ERROR =
  "AppleLLMModule is not linked. Did you rebuild the native app after adding the Swift module?";

type AppleLLMNativeModule = {
  generate(options: { prompt: string }): Promise<{ text: string; finishReason?: string }>;
};

const NativeAppleModule = NativeModules.AppleLLMModule as AppleLLMNativeModule | undefined;

const AppleLLMNative: AppleLLMNativeModule =
  NativeAppleModule ??
  new Proxy(
    {},
    {
      get() {
        throw new Error(LINKING_ERROR);
      },
    },
  );

export class AppleLLMError extends Error {
  code: string;
  constructor(code: string, message: string) {
    super(message);
    this.code = code;
    this.name = "AppleLLMError";
  }
}

export type AppleLLMResponse = { text: string; finishReason?: string };

const iosVersion = Platform.OS === "ios" ? parseFloat(String(Platform.Version)) : 0;
export const isAppleLLMSupported = Platform.OS === "ios" && Number.isFinite(iosVersion) && iosVersion >= 18;
export const isAppleLLMFrameworkLinked = false;

const normalizeAppleError = (error: unknown): AppleLLMError => {
  if (error instanceof AppleLLMError) {
    return error;
  }
  if (error && typeof error === "object") {
    const maybeCode = "code" in error ? String((error as { code?: unknown }).code ?? "GENERATION_FAILED") : "GENERATION_FAILED";
    const maybeMessage = "message" in error ? String((error as { message?: unknown }).message ?? "") : "";
    return new AppleLLMError(maybeCode, maybeMessage || "Apple LLM request failed.");
  }
  return new AppleLLMError("GENERATION_FAILED", "Apple LLM request failed.");
};

export const generateAppleResponse = async (
  prompt: string,
  fallback: () => Promise<AppleLLMResponse>,
): Promise<AppleLLMResponse> => {
  const trimmed = prompt.trim();
  if (!trimmed.length) {
    throw new AppleLLMError("INVALID_PROMPT", "Prompt must not be empty.");
  }

  if (!isAppleLLMSupported) {
    return fallback();
  }

  try {
    const response = await AppleLLMNative.generate({ prompt: trimmed });
    if (!response?.text?.trim().length) {
      throw new AppleLLMError("EMPTY_RESPONSE", "Apple LLM returned an empty reply.");
    }
    return response;
  } catch (error) {
    const normalized = normalizeAppleError(error);
    if (normalized.code === "UNAVAILABLE") {
      return fallback();
    }
    throw normalized;
  }
};

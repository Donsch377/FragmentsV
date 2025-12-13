export class AppleLLMError extends Error {
  code: string;
  constructor(code: string, message: string) {
    super(message);
    this.code = code;
    this.name = "AppleLLMError";
  }
}

export const isAppleLLMSupported = false;
export const isAppleLLMFrameworkLinked = false;

export type AppleLLMResponse = { text: string; finishReason?: string };

export const generateAppleResponse = async (
  _prompt: string,
  fallback: () => Promise<AppleLLMResponse>,
): Promise<AppleLLMResponse> => fallback();

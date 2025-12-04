import type { ToolContext, ToolRunner, DetectedItem } from "../types";
import { parseDetectedItemsFromJson } from "../utils/detectedItemParser";

export type VisionToolInput = {
  imageId: string;
  hintText?: string;
};

export type VisionToolOutput = {
  imageId: string;
  items: DetectedItem[];
};

export const buildVisionPrompt = (input: VisionToolInput) => [
  "You are a vision co-pilot for pantry inventory.",
  "Given a short textual hint describing an image, list the items you believe are present.",
  "Respond with JSON ONLY: an array of { id, label, category, brand, confidence }.",
  `Image reference: ${input.imageId}`,
  `Hint: ${input.hintText ?? "No hint available"}`,
].join("\n");

export const buildVisionTool = (
  callModel: ToolContext["callModel"],
): ToolRunner<VisionToolInput, VisionToolOutput> => {
  return async (input, context) => {
    try {
      const prompt = buildVisionPrompt(input);
      const response = await callModel({
        systemPrompt: "Return valid JSON arrays only.",
        userPrompt: prompt,
        maxTokens: 400,
        responseMode: "json",
      });
      context.logger?.({
        step: `Vision prompt for ${input.imageId}`,
        tool: "vision",
        promptPreview: prompt,
        outputPreview: response.text ?? "",
      });
      const items: DetectedItem[] = parseDetectedItemsFromJson(response.text, input.imageId);
      return {
        name: "vision",
        output: {
          imageId: input.imageId,
          items,
        },
      };
    } catch (error) {
      const message = error instanceof Error ? error.message : "Vision tool failed";
      return { name: "vision", output: { imageId: input.imageId, items: [] }, error: message };
    }
  };
};

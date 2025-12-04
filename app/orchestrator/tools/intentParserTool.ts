import type { ToolContext, ToolRunner, DetectedItem } from "../types";
import { parseDetectedItemsFromJson } from "../utils/detectedItemParser";

export type IntentParserInput = {
  text: string;
};

export type IntentParserOutput = {
  source: "text";
  items: DetectedItem[];
};

export const buildIntentParserTool = (
  callModel: ToolContext["callModel"],
): ToolRunner<IntentParserInput, IntentParserOutput> => {
  return async (input, context) => {
    try {
      const prompt = [
        "You translate a short user request into pantry items.",
        "Rules:",
        "- Respond with JSON array ONLY.",
        "- Each entry must include id (string), label, optional category, and any quantitative hints (amount, unit, calories, protein, etc.).",
        "- If the user mentions nutrition, include it inside a metadata object.",
        "- Do not invent foods that are not implied.",
        "",
        `User request: ${input.text}`,
      ].join("\n");
      const response = await callModel({
        systemPrompt: "Return a JSON array of food detections.",
        userPrompt: prompt,
        responseMode: "json",
        maxTokens: 400,
      });
      context.logger?.({
        step: "Intent parser prompt",
        tool: "intentParser",
        promptPreview: prompt,
        outputPreview: response.text ?? "",
      });
      const items = parseDetectedItemsFromJson(response.text, "text");
      return {
        name: "intentParser",
        output: {
          source: "text",
          items,
        },
      };
    } catch (error) {
      const message = error instanceof Error ? error.message : "Intent parser failed";
      return { name: "intentParser", output: { source: "text", items: [] }, error: message };
    }
  };
};

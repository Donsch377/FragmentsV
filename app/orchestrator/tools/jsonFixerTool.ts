import type { ToolContext, ToolRunner } from "../types";
import type { FoodCommandPayload } from "../../types/commands";

export type JsonFixerInput = {
  original: Record<string, unknown>;
  errors: string[];
};

export type JsonFixerOutput = {
  command: FoodCommandPayload | null;
};

const parseObject = (raw: string | undefined) => {
  if (!raw) return null;
  let sanitized = raw.replace(/```json/gi, "").replace(/```/g, "").trim();
  const firstBrace = sanitized.indexOf("{");
  const lastBrace = sanitized.lastIndexOf("}");
  if (firstBrace >= 0 && lastBrace > firstBrace) {
    sanitized = sanitized.slice(firstBrace, lastBrace + 1);
  }
  try {
    const parsed = JSON.parse(sanitized);
    return parsed && typeof parsed === "object" ? parsed : null;
  } catch {
    return null;
  }
};

export const buildJsonFixerTool = (callModel: ToolContext["callModel"]): ToolRunner<JsonFixerInput, JsonFixerOutput> => {
  return async (input, context) => {
    try {
      const prompt = [
        "You repair invalid JSON so it matches the Fragments /add food contract.",
        "Return JSON only.",
        `Errors: ${input.errors.join("; ")}`,
        "Original JSON:",
        JSON.stringify(input.original, null, 2),
      ].join("\n");
      const response = await callModel({
        systemPrompt: "Respond with corrected JSON that satisfies the errors.",
        userPrompt: prompt,
        responseMode: "json",
        maxTokens: 400,
      });
      context.logger?.({
        step: "JSON fixer prompt",
        tool: "jsonFixer",
        promptPreview: prompt,
        outputPreview: response.text ?? "",
      });
      const command = parseObject(response.text);
      return { name: "jsonFixer", output: { command } };
    } catch (error) {
      const message = error instanceof Error ? error.message : "JSON fixer failed";
      return { name: "jsonFixer", output: { command: null }, error: message };
    }
  };
};

import type { FoodCommandPayload } from "../../types/commands";
import type { DetectedItem, ToolContext, ToolRunner } from "../types";

const parseJsonObject = (raw: string | undefined) => {
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

const ZERO_NUTRIENTS = {
  energy_kcal: "0",
  protein_g: "0",
  carbs_g: "0",
  fat_g: "0",
  sat_fat_g: "0",
  trans_fat_g: "0",
  fiber_g: "0",
  sugar_g: "0",
  sodium_mg: "0",
};

const buildFallbackCommand = ({ item, defaults }: CommandBuilderInput): FoodCommandPayload | null => {
  if (!defaults.groupId) {
    return null;
  }
  const inferredUnit = item.category?.toLowerCase().includes("season") ? "tsp" : "unit";
  return {
    name: item.label || "Pantry Item",
    groupId: defaults.groupId,
    groupName: defaults.groupName,
    location: defaults.location ?? "Pantry",
    imageUrl: defaults.imageUrl,
    servings: [
      {
        id: `${item.id}-serving`,
        label: "Serving 1",
        amount: "1",
        unit: inferredUnit,
        nutrients: { ...ZERO_NUTRIENTS },
      },
    ],
  };
};

export type CommandBuilderInput = {
  item: DetectedItem;
  defaults: {
    groupId?: string;
    groupName?: string;
    location?: string;
    imageUrl?: string;
  };
};

export type CommandBuilderOutput = {
  command: FoodCommandPayload | null;
};

export const buildCommandBuilderTool = (
  callModel: ToolContext["callModel"],
): ToolRunner<CommandBuilderInput, CommandBuilderOutput> => {
  return async (input, context) => {
    try {
      const prompt = [
        "You are a Fragments pantry ingestion bot.",
        "Given a detected grocery item, emit a JSON object matching the /add food contract.",
        "Rules:",
        "- Always include name, groupId, and at least one serving.",
        "- Convert guesses into strings (e.g. \"355\").",
        "- Use provided defaults when available.",
        "- Output JSON only.",
        "",
        "Example template:",
        '{ "name": "...", "groupId": "...", "location": "...", "servings": [ { "id": "unique", "label": "Serving 1", "amount": "1", "unit": "unit", "nutrients": { "energy_kcal": "0", ... } } ] }',
        "",
        `Item: ${JSON.stringify(input.item)}`,
        `Defaults: ${JSON.stringify(input.defaults)}`,
      ].join("\n");
      const response = await callModel({
        systemPrompt: "Return valid JSON with no commentary.",
        userPrompt: prompt,
        responseMode: "json",
        maxTokens: 600,
      });
      context.logger?.({
        step: `CommandBuilder prompt for ${input.item.label}`,
        tool: "commandBuilder",
        promptPreview: prompt,
        outputPreview: response.text ?? "",
      });
      let command = parseJsonObject(response.text) as FoodCommandPayload | null;
      if (!command) {
        context.logger?.({
          step: `CommandBuilder parse failure for ${input.item.label}`,
          tool: "commandBuilder",
          error: "JSON parse error",
          outputPreview: response.text ?? "",
        });
        const fallback = buildFallbackCommand(input);
        if (fallback) {
          context.logger?.({
            step: `CommandBuilder fallback for ${input.item.label}`,
            tool: "commandBuilder",
            outputPreview: JSON.stringify(fallback),
          });
        }
        command = fallback;
      }
      return { name: "commandBuilder", output: { command } };
    } catch (error) {
      const message = error instanceof Error ? error.message : "Command builder failed";
      return { name: "commandBuilder", output: { command: null }, error: message };
    }
  };
};

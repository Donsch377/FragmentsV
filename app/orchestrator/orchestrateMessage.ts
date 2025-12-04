import { createInitialState } from "./state";
import { runPlan } from "./engine";
import { buildVisionPrompt } from "./tools/visionTool";
import { buildCommandBuilderTool } from "./tools/commandBuilderTool";
import { buildJsonFixerTool } from "./tools/jsonFixerTool";
import { buildIntentParserTool } from "./tools/intentParserTool";
import { foodCommandSchema } from "./validation/foodCommandSchema";
import type {
  OrchestratorAttachment,
  OrchestratorJobResult,
  OrchestratorLogEntry,
  ToolContext,
  DetectedItem,
  ToolRunner,
} from "./types";
import type { FoodCommandPayload, FoodLogCommandPayload } from "../types/commands";
import type { NutrientKeys } from "../types/food";

type OrchestrateMessageParams = {
  text: string;
  history?: string;
  attachments: OrchestratorAttachment[];
  defaults: {
    groupId?: string;
    groupName?: string;
    location?: string;
  };
  callModel: ToolContext["callModel"];
  logger?: (entry: OrchestratorLogEntry) => void;
};

const flattenDetected = (state: ReturnType<typeof createInitialState>): DetectedItem[] => {
  return Object.values(state.detectedItems).flat();
};

const FALLBACK_SEASONINGS: DetectedItem[] = [
  { id: "seasoning-1", label: "Sea Salt", category: "Seasoning" },
  { id: "seasoning-2", label: "Smoked Paprika", category: "Seasoning" },
  { id: "seasoning-3", label: "Garlic Powder", category: "Seasoning" },
  { id: "seasoning-4", label: "Cumin", category: "Seasoning" },
];

const LOG_KEYWORDS = /\b(log|logged|logging|ate|eat|eaten|consumed|drink|drank|record|track)\b/;
const ADD_KEYWORDS = /\b(add|restock|stock|pantry|inventory|put|store|organize)\b/;

const determineJobType = (text: string, attachments: OrchestratorAttachment[]): "add" | "log" => {
  if (attachments.length) {
    return "add";
  }
  const normalized = text.toLowerCase();
  const wantsLog = LOG_KEYWORDS.test(normalized);
  const wantsAdd = ADD_KEYWORDS.test(normalized);
  if (wantsLog && !wantsAdd) return "log";
  if (wantsAdd && !wantsLog) return "add";
  return wantsLog ? "log" : "add";
};

const METADATA_NUTRIENT_MAP: Record<string, NutrientKeys> = {
  calories: "energy_kcal",
  energy: "energy_kcal",
  energy_kcal: "energy_kcal",
  protein: "protein_g",
  fat: "fat_g",
  carbs: "carbs_g",
  carbohydrate: "carbs_g",
  carbohydrates: "carbs_g",
  sugar: "sugar_g",
  fiber: "fiber_g",
  sodium: "sodium_mg",
};

const toTrimmedString = (value: unknown): string | undefined => {
  if (value === undefined || value === null) return undefined;
  const text = typeof value === "string" ? value : String(value);
  const trimmed = text.trim();
  return trimmed.length ? trimmed : undefined;
};

const collectNutrientSources = (metadata?: Record<string, unknown>) => {
  if (!metadata) return {};
  const combined: Record<string, unknown> = {};
  const addObject = (value: unknown) => {
    if (value && typeof value === "object" && !Array.isArray(value)) {
      Object.entries(value as Record<string, unknown>).forEach(([key, entryValue]) => {
        combined[key] = entryValue;
      });
    }
  };
  addObject(metadata.nutrients);
  addObject(metadata.nutrition);
  addObject(metadata.macros);
  ["calories", "energy", "energy_kcal", "protein", "fat", "carbs", "carbohydrates", "sugar", "fiber", "sodium"].forEach(
    (key) => {
      const directValue = (metadata as Record<string, unknown>)[key];
      if (directValue !== undefined) {
        combined[key] = directValue;
      }
    },
  );
  return combined;
};

const extractLogNutrients = (metadata?: Record<string, unknown>): Partial<Record<NutrientKeys, string>> | undefined => {
  const sources = collectNutrientSources(metadata);
  const entries = Object.entries(sources);
  if (!entries.length) return undefined;
  const nutrients: Partial<Record<NutrientKeys, string>> = {};
  entries.forEach(([key, value]) => {
    const targetKey = METADATA_NUTRIENT_MAP[key.toLowerCase()];
    if (!targetKey) return;
    if (value === undefined || value === null) return;
    const asString = String(value);
    if (asString.length) {
      nutrients[targetKey] = asString;
    }
  });
  return Object.keys(nutrients).length ? nutrients : undefined;
};

const buildLogCommandFromItem = (
  item: DetectedItem,
  defaults: { groupId?: string; groupName?: string },
): FoodLogCommandPayload => {
  const metadata = item.metadata ?? {};
  const servingAmount =
    (metadata.amount as string | number | undefined) ??
    (metadata.quantity as string | number | undefined) ??
    "1";
  const servingUnit = toTrimmedString(metadata.unit) ?? "unit";
  const servingLabel = toTrimmedString((metadata as Record<string, unknown>).servingLabel) ?? "Serving 1";
  const nutrients = extractLogNutrients(metadata);
  const quantityValue =
    (metadata.quantity as string | number | undefined) ??
    (metadata.amount as string | number | undefined) ??
    "1";
  return {
    mode: "manual",
    groupId: defaults.groupId,
    groupName: defaults.groupName,
    quantity: quantityValue,
    manual: {
      name: item.label,
      groupName: defaults.groupName,
      servingLabel,
      servingAmount,
      servingUnit,
      nutrients,
    },
  };
};

export const orchestrateMessage = async ({
  text,
  history,
  attachments,
  defaults,
  callModel,
  logger,
}: OrchestrateMessageParams): Promise<OrchestratorJobResult> => {
  const state = createInitialState(attachments);
  const contextText = history && history.trim().length ? history : text;
  const jobType = determineJobType(contextText, attachments);
  const planFlow = attachments.length
    ? ["vision", "commandBuilder", "jsonFixer"]
    : jobType === "log"
        ? ["intentParser", "logBuilder"]
        : ["intentParser", "commandBuilder", "jsonFixer"];
  const planSummary = {
    request: contextText.slice(0, 200),
    attachments: attachments.map((attachment) => ({
      id: attachment.id,
      hasUri: Boolean(attachment.uri),
      hint: attachment.debugDescription ?? null,
    })),
    flow: planFlow,
    intent: jobType,
  };
  logger?.({
    step: "Orchestrator plan",
    tool: "explanation",
    outputPreview: JSON.stringify(planSummary),
  });
  const fallbackForAttachment = (attachmentId: string) =>
    FALLBACK_SEASONINGS.map((item) => ({
      ...item,
      id: `${attachmentId}-${item.id}`,
    }));
  if (attachments.length) {
    attachments.forEach((attachment) => {
      const prompt = buildVisionPrompt({
        imageId: attachment.id,
        hintText: attachment.debugDescription ?? text,
      });
      logger?.({
        step: `Vision prompt for ${attachment.id}`,
        tool: "vision",
        promptPreview: prompt,
      });
      const fallbackItems = fallbackForAttachment(attachment.id);
      state.detectedItems[attachment.id] = fallbackItems;
      logger?.({
        step: `Vision fallback for ${attachment.id}`,
        tool: "vision",
        outputPreview: JSON.stringify({ imageId: attachment.id, items: fallbackItems }),
      });
    });
  } else {
    const intentTool = buildIntentParserTool(callModel);
    const intentPlan = {
      steps: [
        {
          tool: {
            name: "intentParser" as const,
            input: { text: contextText },
          },
          description: "Parsing user request",
        },
      ],
      done: false,
    };
    await runPlan({
      plan: intentPlan,
      state,
      tools: { intentParser: intentTool } as Record<string, ToolRunner<any, any>>,
      toolContext: { callModel },
      logger,
      onResult: ({ result }) => {
        if (result?.name === "intentParser" && result.output) {
          const output = result.output as { items: DetectedItem[] };
          state.detectedItems.text = output.items;
        }
      },
    });
    if (!state.detectedItems.text?.length) {
      const fallbackItem: DetectedItem = {
        id: `text-${Date.now()}`,
        label: text.slice(0, 80) || "Food item",
        category: "inferred",
      };
      state.detectedItems.text = [fallbackItem];
      logger?.({
        step: "Intent parser fallback",
        tool: "intentParser",
        outputPreview: JSON.stringify({ items: [fallbackItem] }),
      });
    }
  }

  const detectedItems = flattenDetected(state);
  if (jobType === "log") {
    const logCommands = detectedItems.map((item) => buildLogCommandFromItem(item, defaults));
    state.logCommands.push(...logCommands);
    const summary = [
      `Detected ${detectedItems.length} item${detectedItems.length === 1 ? "" : "s"}.`,
      `Prepared ${logCommands.length} log command${logCommands.length === 1 ? "" : "s"}.`,
    ].join(" ");
    return {
      summary,
      state,
      logs: [],
      generatedCommands: [],
      generatedLogCommands: logCommands,
      failures: [...state.failures],
    };
  }
  const builderTool = buildCommandBuilderTool(callModel);
  const builderPlan = {
    steps: detectedItems.map((item) => ({
      tool: {
        name: "commandBuilder" as const,
        input: { item, defaults },
      },
      description: `Building command for ${item.label}`,
    })),
    done: false,
  };

  await runPlan({
    plan: builderPlan,
    state,
    tools: { commandBuilder: builderTool } as Record<string, ToolRunner<any, any>>,
    toolContext: { callModel },
    logger,
    onResult: ({ result }) => {
      if (result?.name === "commandBuilder" && result.output) {
        const { command } = result.output as { command: FoodCommandPayload | null };
        if (command) {
          state.commands.push(command);
        }
      }
    },
  });

  const validated: FoodCommandPayload[] = [];
  const fixerTool = buildJsonFixerTool(callModel);

  for (const command of state.commands) {
    const parsed = foodCommandSchema.safeParse(command);
    if (parsed.success) {
      validated.push(parsed.data);
      continue;
    }
    const errors = parsed.error.issues.map((issue) => `${issue.path.join(".")}: ${issue.message}`);
    logger?.({
      step: "validator",
      tool: "jsonFixer",
      inputPreview: JSON.stringify(command).slice(0, 200),
      error: errors.join(" | "),
    });
    const fixerResult = await fixerTool({ original: command, errors }, { callModel, logger });
    if (fixerResult.output.command) {
      const recheck = foodCommandSchema.safeParse(fixerResult.output.command);
      if (recheck.success) {
        validated.push(recheck.data);
      } else {
        state.validationErrors.push(recheck.error.message);
      }
    } else if (fixerResult.error) {
      state.validationErrors.push(fixerResult.error);
    }
  }

  const summary = [
    `Detected ${detectedItems.length} item${detectedItems.length === 1 ? "" : "s"}.`,
    `Built ${state.commands.length} command${state.commands.length === 1 ? "" : "s"}.`,
    `Validated ${validated.length}; ${state.validationErrors.length} failed.`,
  ].join(" ");

  return {
    summary,
    state,
    logs: [],
    generatedCommands: validated,
    failures: [...state.failures, ...state.validationErrors],
  };
};

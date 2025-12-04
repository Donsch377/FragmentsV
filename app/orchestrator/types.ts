import type { FoodCommandPayload, FoodLogCommandPayload } from "../types/commands";

export type ToolName = "vision" | "intentParser" | "commandBuilder" | "jsonFixer" | "explanation";

export type ToolCall<TInput = unknown> = {
  name: ToolName;
  input: TInput;
};

export type ToolResult<TOutput = unknown> = {
  name: ToolName;
  output: TOutput;
  error?: string;
};

export type OrchestratorStep = {
  tool: ToolCall;
  description?: string;
};

export type OrchestratorPlan = {
  steps: OrchestratorStep[];
  done: boolean;
  notes?: string;
};

export type OrchestratorAttachment = {
  id: string;
  uri?: string;
  debugDescription?: string;
};

export type DetectedItem = {
  id: string;
  label: string;
  category?: string;
  confidence?: number;
  brand?: string;
  notes?: string;
  metadata?: Record<string, unknown>;
};

export type OrchestratorState = {
  attachments: OrchestratorAttachment[];
  detectedItems: Record<string, DetectedItem[]>;
  commands: FoodCommandPayload[];
  logCommands: FoodLogCommandPayload[];
  validationErrors: string[];
  failures: string[];
};

export type TextModelCallParams = {
  systemPrompt: string;
  userPrompt: string;
  maxTokens?: number;
  responseMode?: "json" | "text";
};

export type TextModelCallResult = {
  text: string;
  truncated: boolean;
};

export type ToolContext = {
  callModel: (params: TextModelCallParams) => Promise<TextModelCallResult>;
  logger?: (entry: OrchestratorLogEntry) => void;
};

export type ToolRunner<TInput = unknown, TOutput = unknown> = (
  input: TInput,
  context: ToolContext,
) => Promise<ToolResult<TOutput>>;

export type OrchestratorLogEntry = {
  step: string;
  tool: ToolName;
  inputPreview?: string;
  outputPreview?: string;
  promptPreview?: string;
  error?: string;
};

export type OrchestratorJobResult = {
  summary: string;
  state: OrchestratorState;
  logs: OrchestratorLogEntry[];
  generatedCommands: FoodCommandPayload[];
  generatedLogCommands?: FoodLogCommandPayload[];
  failures: string[];
};

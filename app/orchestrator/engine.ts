import type {
  OrchestratorPlan,
  OrchestratorState,
  ToolContext,
  ToolRunner,
  OrchestratorLogEntry,
} from "./types";

type RunPlanParams = {
  plan: OrchestratorPlan;
  state: OrchestratorState;
  tools: Record<string, ToolRunner<any, any>>;
  toolContext: Omit<ToolContext, "logger">;
  logger?: (entry: OrchestratorLogEntry) => void;
  onResult?: (args: { stepIndex: number; result?: Awaited<ReturnType<ToolRunner>> }) => void;
};

export const runPlan = async ({ plan, state, tools, toolContext, logger, onResult }: RunPlanParams) => {
  const logs: OrchestratorLogEntry[] = [];
  for (let index = 0; index < plan.steps.length; index += 1) {
    const step = plan.steps[index];
    const tool = tools[step.tool.name];
    const logEntry: OrchestratorLogEntry = {
      step: step.description ?? step.tool.name,
      tool: step.tool.name,
      inputPreview: JSON.stringify(step.tool.input).slice(0, 200),
    };
    try {
      if (!tool) {
        logEntry.error = "Tool not implemented";
        state.failures.push(`${step.tool.name}: not implemented`);
      } else {
        const result = await tool(step.tool.input, {
          ...toolContext,
          logger,
        });
        if (result.error) {
          logEntry.error = result.error;
        } else if (result.output) {
          logEntry.outputPreview = JSON.stringify(result.output).slice(0, 200);
        }
        onResult?.({ stepIndex: index, result });
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      logEntry.error = message;
      state.failures.push(`${step.tool.name}: ${message}`);
    }
    logs.push(logEntry);
    logger?.(logEntry);
  }
  return { state, logs };
};

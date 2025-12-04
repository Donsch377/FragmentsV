import type { OrchestratorAttachment, OrchestratorState } from "./types";

export const createInitialState = (attachments: OrchestratorAttachment[] = []): OrchestratorState => ({
  attachments,
  detectedItems: {},
  commands: [],
  logCommands: [],
  validationErrors: [],
  failures: [],
});

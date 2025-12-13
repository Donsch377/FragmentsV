import { useLLM, type Message as LlmMessage, type ResourceSource } from "react-native-executorch";

const noop = () => {};
const asyncNoop = async () => {};

export type ExecModelAdapter = {
  configure: ReturnType<typeof useLLM>["configure"] | typeof noop;
  generate: ReturnType<typeof useLLM>["generate"] | typeof asyncNoop;
  ready: boolean;
  generating: boolean;
  downloadProgress: number;
  error: unknown;
  response: string;
  messageHistory: LlmMessage[];
  interrupt: ReturnType<typeof useLLM>["interrupt"] | undefined;
};

export const EMPTY_EXEC_MODEL: ExecModelAdapter = {
  configure: noop,
  generate: asyncNoop,
  ready: false,
  generating: false,
  downloadProgress: 0,
  error: null,
  response: "",
  messageHistory: [],
  interrupt: undefined,
};

type ExecModelResource = {
  modelSource: ResourceSource;
  tokenizerSource: ResourceSource;
  tokenizerConfigSource: ResourceSource;
};

export const useExecModel = (modelResource: ExecModelResource, shouldLoad: boolean): ExecModelAdapter => {
  const execInstance = useLLM({ model: modelResource, preventLoad: !shouldLoad });
  if (!execInstance) {
    console.log("[useExecModel] No ExecuTorch instance yet", { modelResource, shouldLoad });
    return EMPTY_EXEC_MODEL;
  }
  return {
    configure: execInstance.configure ?? noop,
    generate: execInstance.generate ?? asyncNoop,
    ready: execInstance.isReady ?? false,
    generating: execInstance.isGenerating ?? false,
    downloadProgress: execInstance.downloadProgress ?? 0,
    error: execInstance.error ?? null,
    response: execInstance.response ?? "",
    messageHistory: (execInstance.messageHistory ?? []) as LlmMessage[],
    interrupt: execInstance.interrupt,
  };
};

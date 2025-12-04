import type { ResourceSource } from "react-native-executorch";
import {
  LLAMA3_2_3B_SPINQUANT,
  LLAMA3_2_1B_SPINQUANT,
  QWEN3_1_7B_QUANTIZED,
} from "react-native-executorch";

export type OnDeviceModelKey = "llama3_2_3b_spinquant" | "llama3_2_1b_spinquant" | "qwen3_1_7b_quantized";

export type OnDeviceModelDefinition = {
  label: string;
  description: string;
  size: string;
  contextWindow: number;
  resource: {
    modelSource: ResourceSource;
    tokenizerSource: ResourceSource;
    tokenizerConfigSource: ResourceSource;
  };
};

export const DEFAULT_ON_DEVICE_MODEL: OnDeviceModelKey = "llama3_2_3b_spinquant";

export const ON_DEVICE_MODEL_MAP: Record<OnDeviceModelKey, OnDeviceModelDefinition> = {
  llama3_2_3b_spinquant: {
    label: "Llama 3.2 3B (SpinQuant)",
    description: "Best overall quality with quantization tuned for mobile NPUs/Metal. 4K context.",
    size: "≈1.6 GB download",
    contextWindow: 4096,
    resource: LLAMA3_2_3B_SPINQUANT,
  },
  llama3_2_1b_spinquant: {
    label: "Llama 3.2 1B (SpinQuant)",
    description: "Smallest variant for older phones; faster but less accurate. 4K context.",
    size: "≈780 MB download",
    contextWindow: 4096,
    resource: LLAMA3_2_1B_SPINQUANT,
  },
  qwen3_1_7b_quantized: {
    label: "Qwen 3 1.7B (int4)",
    description: "Alibaba’s multilingual model tuned for instruction following with a 4K window.",
    size: "≈2.1 GB download",
    contextWindow: 4096,
    resource: QWEN3_1_7B_QUANTIZED,
  },
};

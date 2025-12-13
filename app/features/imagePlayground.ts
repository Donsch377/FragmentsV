import { NativeModules, Platform } from "react-native";

export type GenerateOptions = {
  prompt: string;
  style?: string;
  count?: number;
};

export type GeneratedImage = {
  uri: string;
  width: number;
  height: number;
};

type ImagePlaygroundModuleType = {
  generate(options: GenerateOptions): Promise<GeneratedImage | GeneratedImage[]>;
};

const LINKING_ERROR =
  "ImagePlaygroundModule is not available. Build the iOS app after adding the native module.";

const NativeImagePlayground: ImagePlaygroundModuleType =
  NativeModules.ImagePlaygroundModule ??
  new Proxy(
    {},
    {
      get() {
        throw new Error(LINKING_ERROR);
      },
    },
  );

const iosVersion = Platform.OS === "ios" ? parseFloat(String(Platform.Version)) : 0;
const MIN_SUPPORTED_VERSION = 18.4;

export const isImagePlaygroundSupported =
  Platform.OS === "ios" && Number.isFinite(iosVersion) && iosVersion >= MIN_SUPPORTED_VERSION;

export const generateImage = async (
  options: GenerateOptions,
): Promise<GeneratedImage | GeneratedImage[]> => {
  if (!isImagePlaygroundSupported) {
    throw new Error("Image Playground is available on iOS 18.4 or newer.");
  }
  if (!options.prompt?.trim().length) {
    throw new Error("Enter a prompt before generating an image.");
  }
  const payload = await NativeImagePlayground.generate({
    ...options,
    prompt: options.prompt.trim(),
  });
  return payload;
};

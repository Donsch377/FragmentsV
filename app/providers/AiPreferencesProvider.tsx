import AsyncStorage from "@react-native-async-storage/async-storage";
import { ReactNode, createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import { DEFAULT_ON_DEVICE_MODEL, type OnDeviceModelKey } from "../constants/onDeviceModels";
import { CHAT_RESPONSE_MODES, DEFAULT_CHAT_RESPONSE_MODE, type ChatResponseMode } from "../constants/aiConfig";

export type LlmProvider = "openSource" | "apple";

type AiPreferencesValue = {
  provider: LlmProvider;
  modelKey: OnDeviceModelKey;
  chatMode: ChatResponseMode;
  setProvider: (provider: LlmProvider) => Promise<void>;
  setModelKey: (modelKey: OnDeviceModelKey) => Promise<void>;
  setChatMode: (mode: ChatResponseMode) => Promise<void>;
  hydrated: boolean;
};

const STORAGE_KEY = "fragments.aiPreferences";

const AiPreferencesContext = createContext<AiPreferencesValue>({
  provider: "openSource",
  modelKey: DEFAULT_ON_DEVICE_MODEL,
  chatMode: DEFAULT_CHAT_RESPONSE_MODE,
  setProvider: async () => {},
  setModelKey: async () => {},
  setChatMode: async () => {},
  hydrated: false,
});

type PersistedShape = {
  provider?: LlmProvider;
  modelKey?: OnDeviceModelKey;
  chatMode?: ChatResponseMode;
};

export const AiPreferencesProvider = ({ children }: { children: ReactNode }) => {
  const [provider, setProvider] = useState<LlmProvider>("openSource");
  const [modelKey, setModelKey] = useState<OnDeviceModelKey>(DEFAULT_ON_DEVICE_MODEL);
  const [chatMode, setChatMode] = useState<ChatResponseMode>(DEFAULT_CHAT_RESPONSE_MODE);
  const [hydrated, setHydrated] = useState(false);

  useEffect(() => {
    let cancelled = false;
    const load = async () => {
      try {
        const stored = await AsyncStorage.getItem(STORAGE_KEY);
        if (stored) {
          const parsed: PersistedShape = JSON.parse(stored);
          if (parsed.provider) {
            setProvider(parsed.provider);
          }
          if (parsed.modelKey) {
            setModelKey(parsed.modelKey);
          }
          if (parsed.chatMode && CHAT_RESPONSE_MODES[parsed.chatMode]) {
            setChatMode(parsed.chatMode);
          }
        }
      } catch (error) {
        console.warn("[AI prefs] Unable to load stored preferences", error);
      } finally {
        if (!cancelled) {
          setHydrated(true);
        }
      }
    };
    load();
    return () => {
      cancelled = true;
    };
  }, []);

  const persist = useCallback(
    async (next: PersistedShape) => {
      try {
        await AsyncStorage.setItem(
          STORAGE_KEY,
          JSON.stringify({
            provider: next.provider ?? provider,
            modelKey: next.modelKey ?? modelKey,
            chatMode: next.chatMode ?? chatMode,
          }),
        );
      } catch (error) {
        console.warn("[AI prefs] Unable to persist preferences", error);
      }
    },
    [chatMode, modelKey, provider],
  );

  const handleSetProvider = useCallback(
    async (nextProvider: LlmProvider) => {
      setProvider(nextProvider);
      await persist({ provider: nextProvider });
    },
    [persist],
  );

  const handleSetModelKey = useCallback(
    async (nextKey: OnDeviceModelKey) => {
      setModelKey(nextKey);
      await persist({ modelKey: nextKey });
    },
    [persist],
  );

  const handleSetChatMode = useCallback(
    async (nextMode: ChatResponseMode) => {
      if (!CHAT_RESPONSE_MODES[nextMode]) {
        return;
      }
      setChatMode(nextMode);
      await persist({ chatMode: nextMode });
    },
    [persist],
  );

  const value = useMemo(
    () => ({
      provider,
      modelKey,
      chatMode,
      setProvider: handleSetProvider,
      setModelKey: handleSetModelKey,
      setChatMode: handleSetChatMode,
      hydrated,
    }),
    [chatMode, handleSetChatMode, handleSetModelKey, handleSetProvider, hydrated, modelKey, provider],
  );

  return <AiPreferencesContext.Provider value={value}>{children}</AiPreferencesContext.Provider>;
};

export const useAiPreferences = () => useContext(AiPreferencesContext);

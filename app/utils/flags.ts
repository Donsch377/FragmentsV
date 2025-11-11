import Constants from "expo-constants";

export const flags = {
  useLocalDB: Boolean(Constants.expoConfig?.extra?.USE_LOCAL_DB),
  devUserId: String(Constants.expoConfig?.extra?.DEV_USER_ID ?? "dev"),
};

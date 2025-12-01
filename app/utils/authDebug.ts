import { supabase } from "../lib/supabaseClient";

export type AuthDebugSnapshot = {
  context: string;
  groupId: string | null;
  sessionUserId: string | null;
  rpcAuthUid: string | null;
  rpcError?: string;
};

export const captureAuthDebugSnapshot = async (
  context: string,
  groupId: string | null,
): Promise<AuthDebugSnapshot> => {
  try {
    const { data: sessionData } = await supabase.auth.getSession();
    const sessionUserId = sessionData.session?.user?.id ?? null;
    const { data: rpcData, error: rpcError } = await supabase.rpc<string | null>(
      "debug_auth_uid",
    );

    const snapshot: AuthDebugSnapshot = {
      context,
      groupId,
      sessionUserId,
      rpcAuthUid: rpcData ?? null,
      rpcError: rpcError?.message,
    };
    console.log(`[AuthDebug:${context}]`, snapshot);
    return snapshot;
  } catch (error: any) {
    console.warn(`[AuthDebug:${context}] Failed to capture`, error);
    return {
      context,
      groupId,
      sessionUserId: null,
      rpcAuthUid: null,
      rpcError: error?.message ?? "capture failure",
    };
  }
};

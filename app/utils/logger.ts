type LogLevel = "log" | "info" | "warn" | "error";

export type LogEntry = {
  id: string;
  level: LogLevel;
  message: string;
  timestamp: number;
};

const MAX_LOGS = 100;
const logBuffer: LogEntry[] = [];
let installed = false;

const pushLog = (level: LogLevel, message: string) => {
  logBuffer.push({
    id: `${Date.now()}-${Math.random().toString(16).slice(2)}`,
    level,
    message,
    timestamp: Date.now(),
  });

  if (logBuffer.length > MAX_LOGS) {
    logBuffer.splice(0, logBuffer.length - MAX_LOGS);
  }
};

export const installLoggerTap = () => {
  if (installed) {
    return;
  }

  (["log", "info", "warn", "error"] as const).forEach((level) => {
    const original = console[level];
    console[level] = (...args: unknown[]) => {
      try {
        const serialized = args
          .map((value) =>
            typeof value === "string" ? value : JSON.stringify(value, null, 2)
          )
          .join(" ");
        pushLog(level, serialized);
      } catch {
        pushLog(level, "Unable to serialize log payload");
      }

      // eslint-disable-next-line prefer-spread
      original.apply(console, args as []);
    };
  });

  installed = true;
};

export const getLogs = () => [...logBuffer].reverse();

export const clearLogs = () => {
  logBuffer.length = 0;
};

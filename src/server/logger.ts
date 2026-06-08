type LogLevel = "error" | "warn" | "info" | "debug";

const LEVEL_RANK: Record<LogLevel, number> = {
  error: 0,
  warn: 1,
  info: 2,
  debug: 3,
};

function currentNodeEnv(): string {
  return process.env.NODE_ENV || "development";
}

function resolveMinLevel(): LogLevel {
  const raw = String(process.env.LOG_LEVEL || "").trim().toLowerCase();
  if (raw === "error" || raw === "warn" || raw === "info" || raw === "debug") return raw;
  return currentNodeEnv() === "production" ? "info" : "debug";
}

const minLevel = resolveMinLevel();

function shouldLog(level: LogLevel): boolean {
  return LEVEL_RANK[level] <= LEVEL_RANK[minLevel];
}

export type LogContext = Record<string, unknown>;

function serializeError(error: unknown): LogContext | undefined {
  if (!error) return undefined;
  if (error instanceof Error) {
    return { errorName: error.name, errorMessage: error.message, stack: error.stack };
  }
  return { errorValue: String(error) };
}

function write(level: LogLevel, message: string, context?: LogContext) {
  if (!shouldLog(level)) return;
  const entry = {
    ts: new Date().toISOString(),
    level,
    msg: message,
    service: "infinitecore-api",
    env: currentNodeEnv(),
    ...context,
  };
  const line = JSON.stringify(entry);
  if (level === "error") console.error(line);
  else if (level === "warn") console.warn(line);
  else console.log(line);
}

export type Logger = {
  error: (message: string, context?: LogContext) => void;
  warn: (message: string, context?: LogContext) => void;
  info: (message: string, context?: LogContext) => void;
  debug: (message: string, context?: LogContext) => void;
  child: (bindings: LogContext) => Logger;
};

function createLogger(bindings: LogContext = {}): Logger {
  const withBindings = (context?: LogContext): LogContext | undefined => {
    if (!bindings || !Object.keys(bindings).length) return context;
    if (!context) return { ...bindings };
    return { ...bindings, ...context };
  };

  return {
    error(message, context) {
      write("error", message, withBindings(context));
    },
    warn(message, context) {
      write("warn", message, withBindings(context));
    },
    info(message, context) {
      write("info", message, withBindings(context));
    },
    debug(message, context) {
      write("debug", message, withBindings(context));
    },
    child(extra) {
      return createLogger({ ...bindings, ...extra });
    },
  };
}

export const logger = createLogger();

export function logHttpRequest(input: {
  method: string;
  path: string;
  statusCode: number;
  durationMs: number;
  requestId: string;
}) {
  const level: LogLevel = input.statusCode >= 500 ? "error" : input.statusCode >= 400 ? "warn" : "info";
  write(level, "http_request", input);
}

export function logServerError(message: string, error: unknown, context?: LogContext) {
  write("error", message, { ...context, ...serializeError(error) });
}

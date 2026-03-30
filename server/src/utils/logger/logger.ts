import pino from "pino";

const level = process.env.LOG_LEVEL || "info";

export const logger = pino({
  level,
  base: null,
  timestamp: pino.stdTimeFunctions.epochTime,
});

export const createChildLogger = (bindings: Record<string, unknown>) => {
  return logger.child(bindings);
};
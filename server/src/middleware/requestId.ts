import { Request, Response, NextFunction } from "express";
import { v4 as uuidv4 } from "uuid";
import { logger } from "../utils/logger/logger.js";

declare module "express-serve-static-core" {
  interface Request {
    id: string;
    log: ReturnType<typeof logger.child>;
  }
}

export const requestLogger = (req: Request, res: Response, next: NextFunction) => {
  req.id = uuidv4();
  req.log = logger.child({ requestId: req.id, module: "http" });

  const start = Date.now();

  res.on("finish", () => {
    const level = res.statusCode >= 500 ? "error" : res.statusCode >= 400 ? "warn" : "info";
    req.log[level]({
      method: req.method,
      url: req.url,
      statusCode: res.statusCode,
      responseTime: Date.now() - start,
    }, "request completed");
  });

  next();
};

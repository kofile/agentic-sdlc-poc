import express, { type Express, type NextFunction, type Request, type Response } from "express";
import type Database from "better-sqlite3";
import { customerRoutes } from "./customers/routes.js";
import { inventoryRoutes } from "./inventory/routes.js";
import { orderRoutes } from "./orders/routes.js";
import { discountRoutes } from "./discounts/routes.js";
import { exportRoutes } from "./export/routes.js";
import { HttpError } from "./errors.js";

export function createApp(db: Database.Database): Express {
  const app = express();
  app.use(express.json());

  app.get("/health", (_req, res) => {
    res.json({ status: "ok" });
  });

  app.use("/customers", customerRoutes(db));
  app.use("/products", inventoryRoutes(db));
  app.use("/orders", orderRoutes(db));
  app.use("/discounts", discountRoutes(db));
  app.use("/export", exportRoutes(db));

  app.use((req, res) => {
    res.status(404).json({ error: `no route for ${req.method} ${req.path}` });
  });

  // Must be declared with 4 args for Express to treat it as an error handler.
  app.use((err: unknown, _req: Request, res: Response, _next: NextFunction) => {
    if (err instanceof HttpError) {
      res.status(err.status).json({ error: err.message, details: err.details });
      return;
    }
    // eslint-disable-next-line no-console
    console.error(err);
    res.status(500).json({ error: "internal server error" });
  });

  return app;
}

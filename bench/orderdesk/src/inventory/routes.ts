import { Router } from "express";
import type Database from "better-sqlite3";
import { InventoryService } from "./service.js";
import { ValidationError } from "../errors.js";

export function inventoryRoutes(db: Database.Database): Router {
  const router = Router();
  const service = new InventoryService(db);

  router.post("/", (req, res, next) => {
    try {
      const product = service.create(req.body ?? {});
      res.status(201).json(product);
    } catch (err) {
      next(err);
    }
  });

  router.get("/", (req, res, next) => {
    try {
      const result = service.list(req.query as Record<string, unknown>);
      res.json(result);
    } catch (err) {
      next(err);
    }
  });

  router.get("/:id", (req, res, next) => {
    try {
      const product = service.getById(Number(req.params.id));
      res.json(product);
    } catch (err) {
      next(err);
    }
  });

  router.post("/:id/adjust-stock", (req, res, next) => {
    try {
      const delta = req.body?.delta;
      if (typeof delta !== "number" || !Number.isInteger(delta)) {
        throw new ValidationError("delta must be an integer");
      }
      const product = service.adjustStock(Number(req.params.id), delta);
      res.json(product);
    } catch (err) {
      next(err);
    }
  });

  router.patch("/:id/price", (req, res, next) => {
    try {
      const product = service.updatePrice(Number(req.params.id), req.body?.price_cents);
      res.json(product);
    } catch (err) {
      next(err);
    }
  });

  return router;
}

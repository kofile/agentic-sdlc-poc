import { Router } from "express";
import type Database from "better-sqlite3";
import { DiscountService } from "./service.js";

export function discountRoutes(db: Database.Database): Router {
  const router = Router();
  const service = new DiscountService(db);

  router.post("/", (req, res, next) => {
    try {
      const discount = service.create(req.body ?? {});
      res.status(201).json(discount);
    } catch (err) {
      next(err);
    }
  });

  router.get("/", (_req, res, next) => {
    try {
      res.json(service.list());
    } catch (err) {
      next(err);
    }
  });

  router.get("/:code", (req, res, next) => {
    try {
      res.json(service.getByCode(req.params.code));
    } catch (err) {
      next(err);
    }
  });

  router.post("/:code/deactivate", (req, res, next) => {
    try {
      res.json(service.deactivate(req.params.code));
    } catch (err) {
      next(err);
    }
  });

  return router;
}

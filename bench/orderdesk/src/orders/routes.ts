import { Router } from "express";
import type Database from "better-sqlite3";
import { OrderService } from "./service.js";

export function orderRoutes(db: Database.Database): Router {
  const router = Router();
  const service = new OrderService(db);

  router.post("/", (req, res, next) => {
    try {
      const order = service.create(req.body ?? {});
      res.status(201).json(order);
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
      const order = service.getById(Number(req.params.id));
      res.json(order);
    } catch (err) {
      next(err);
    }
  });

  router.post("/:id/pay", (req, res, next) => {
    try {
      res.json(service.pay(Number(req.params.id)));
    } catch (err) {
      next(err);
    }
  });

  router.post("/:id/fulfill", (req, res, next) => {
    try {
      res.json(service.fulfill(Number(req.params.id)));
    } catch (err) {
      next(err);
    }
  });

  router.post("/:id/cancel", (req, res, next) => {
    try {
      res.json(service.cancel(Number(req.params.id)));
    } catch (err) {
      next(err);
    }
  });

  return router;
}

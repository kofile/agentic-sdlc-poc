import { Router } from "express";
import type Database from "better-sqlite3";
import { CustomerService } from "./service.js";

export function customerRoutes(db: Database.Database): Router {
  const router = Router();
  const service = new CustomerService(db);

  router.post("/", (req, res, next) => {
    try {
      const customer = service.create(req.body ?? {});
      res.status(201).json(customer);
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
      const customer = service.getById(Number(req.params.id));
      res.json(customer);
    } catch (err) {
      next(err);
    }
  });

  router.patch("/:id", (req, res, next) => {
    try {
      const customer = service.update(Number(req.params.id), req.body ?? {});
      res.json(customer);
    } catch (err) {
      next(err);
    }
  });

  router.delete("/:id", (req, res, next) => {
    try {
      service.delete(Number(req.params.id));
      res.status(204).send();
    } catch (err) {
      next(err);
    }
  });

  return router;
}

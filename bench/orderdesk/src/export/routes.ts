import { Router } from "express";
import type Database from "better-sqlite3";
import { ExportService } from "./service.js";

export function exportRoutes(db: Database.Database): Router {
  const router = Router();
  const service = new ExportService(db);

  router.get("/orders", (req, res, next) => {
    try {
      const csv = service.toCsv({
        from: req.query.from as string | undefined,
        to: req.query.to as string | undefined,
        status: req.query.status as string | undefined,
      });
      res.setHeader("Content-Type", "text/csv");
      res.setHeader("Content-Disposition", "attachment; filename=orders.csv");
      res.send(csv);
    } catch (err) {
      next(err);
    }
  });

  return router;
}

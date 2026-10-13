import { Router } from "express";
import { listPrintersRequestSchema } from "print-common";
import type { PrintersController } from "../controllers/printers.controller";
import { normalizeListQuery, validate } from "../middlewares";

export function buildPrintersRouter(controller: PrintersController): Router {
  const router = Router();

  router.get("/", normalizeListQuery, validate(listPrintersRequestSchema, "query"), controller.list);
  router.get("/:printerId/status", controller.getStatus);
  router.get("/:printerId/queue", controller.getQueue);
  router.get("/:printerId", controller.get);

  return router;
}

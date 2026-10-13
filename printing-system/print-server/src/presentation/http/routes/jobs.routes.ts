import { Router, type NextFunction, type Request, type Response } from "express";
import { cancelJobRequestSchema, listJobsRequestSchema, printRequestSchema } from "print-common";
import type { JobsController } from "../controllers/jobs.controller";
import { validate, normalizeListQuery } from "../middlewares";

/** Copies the `:jobId` path param into the body so it satisfies `CancelJobRequest`'s shape. */
function mergeJobIdIntoBody(req: Request, _res: Response, next: NextFunction): void {
  req.body = { ...req.body, jobId: req.params.jobId };
  next();
}

export function buildJobsRouter(controller: JobsController): Router {
  const router = Router();

  router.post("/", validate(printRequestSchema, "body"), controller.create);
  router.get("/", normalizeListQuery, validate(listJobsRequestSchema, "query"), controller.list);
  router.get("/:jobId/status", controller.getStatus);
  router.get("/:jobId", controller.get);
  router.post(
    "/:jobId/cancel",
    mergeJobIdIntoBody,
    validate(cancelJobRequestSchema, "body"),
    controller.cancel
  );

  return router;
}

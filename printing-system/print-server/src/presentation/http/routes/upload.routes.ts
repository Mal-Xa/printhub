import { Router } from "express";
import type { UploadController } from "../controllers/upload.controller";
import { buildUploadMiddleware } from "../middlewares";

export function buildUploadRouter(controller: UploadController, maxSizeBytes: number): Router {
  const router = Router();
  router.post("/", buildUploadMiddleware(maxSizeBytes), controller.upload);
  return router;
}

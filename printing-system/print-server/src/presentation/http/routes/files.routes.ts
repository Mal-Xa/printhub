import { Router } from "express";
import type { FilesController } from "../controllers/files.controller";

export function buildFilesRouter(controller: FilesController): Router {
  const router = Router();
  router.get("/:fileId", controller.download);
  return router;
}

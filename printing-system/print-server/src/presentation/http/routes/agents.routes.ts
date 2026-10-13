import { Router, type NextFunction, type Request, type Response } from "express";
import {
  agentRegistrationRequestSchema,
  heartbeatRequestSchema,
  paginationParamsSchema,
} from "print-common";
import type { AgentsController } from "../controllers/agents.controller";
import { normalizeListQuery, validate } from "../middlewares";

/** Copies the `:agentId` path param into the body so it satisfies `HeartbeatRequest`'s shape. */
function mergeAgentIdIntoBody(req: Request, _res: Response, next: NextFunction): void {
  req.body = { ...req.body, agentId: req.params.agentId };
  next();
}

export function buildAgentsRouter(controller: AgentsController): Router {
  const router = Router();

  router.post("/register", validate(agentRegistrationRequestSchema, "body"), controller.register);
  router.post(
    "/:agentId/heartbeat",
    mergeAgentIdIntoBody,
    validate(heartbeatRequestSchema, "body"),
    controller.heartbeat
  );
  router.get("/", normalizeListQuery, validate(paginationParamsSchema, "query"), controller.list);
  router.get("/:agentId", controller.get);

  return router;
}

import type { NextFunction, Request, Response } from "express";
import {
  asAgentId,
  type AgentRegistrationRequest,
  type AgentRegistrationResponse,
  type ApiSuccessResponse,
  type HeartbeatRequest,
  type HeartbeatResponse,
  type ListAgentsResponse,
} from "print-common";
import type { AgentService } from "../../../application/services/agent.service";

interface AgentIdParams {
  agentId: string;
}

export class AgentsController {
  constructor(private readonly agentService: AgentService) {}

  register = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const request = req.body as AgentRegistrationRequest;
      const result: AgentRegistrationResponse = await this.agentService.register(request);
      res.status(201).json(result);
    } catch (err) {
      next(err);
    }
  };

  heartbeat = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const agentId = asAgentId(req.params.agentId as string);
      const request = req.body as HeartbeatRequest;
      const result: HeartbeatResponse = await this.agentService.heartbeat(agentId, request);
      res.status(200).json(result);
    } catch (err) {
      next(err);
    }
  };

  get = async (req: Request<AgentIdParams>, res: Response, next: NextFunction): Promise<void> => {
    try {
      const agent = await this.agentService.getAgent(asAgentId(req.params.agentId));
      const body: ApiSuccessResponse<typeof agent> = { data: agent };
      res.status(200).json(body);
    } catch (err) {
      next(err);
    }
  };

  list = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const { page, pageSize } = req.query as unknown as { page: number; pageSize: number };
      const result = await this.agentService.listAgents({ page, pageSize });
      const body: ListAgentsResponse = { data: result.items, pagination: result.pagination };
      res.status(200).json(body);
    } catch (err) {
      next(err);
    }
  };
}

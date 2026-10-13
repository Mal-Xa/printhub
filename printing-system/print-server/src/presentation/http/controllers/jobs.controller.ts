import type { NextFunction, Request, Response } from "express";
import {
  asJobId,
  type ApiSuccessResponse,
  type CancelJobRequest,
  type CancelJobResponse,
  type JobStatusResponse,
  type ListJobsRequest,
  type ListJobsResponse,
  type PrintRequest,
  type PrintResponse,
} from "print-common";
import type { JobService } from "../../../application/services/job.service";

interface JobIdParams {
  jobId: string;
}

export class JobsController {
  constructor(private readonly jobService: JobService) {}

  create = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const request = req.body as PrintRequest;
      const job = await this.jobService.createJob(request);
      const body: PrintResponse = { job };
      res.status(201).json(body);
    } catch (err) {
      next(err);
    }
  };

  get = async (req: Request<JobIdParams>, res: Response, next: NextFunction): Promise<void> => {
    try {
      const job = await this.jobService.getJob(asJobId(req.params.jobId));
      const body: ApiSuccessResponse<typeof job> = { data: job };
      res.status(200).json(body);
    } catch (err) {
      next(err);
    }
  };

  list = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const request = req.query as unknown as ListJobsRequest;
      const result = await this.jobService.listJobs(request);
      const body: ListJobsResponse = { data: result.items, pagination: result.pagination };
      res.status(200).json(body);
    } catch (err) {
      next(err);
    }
  };

  getStatus = async (req: Request<JobIdParams>, res: Response, next: NextFunction): Promise<void> => {
    try {
      const job = await this.jobService.getJob(asJobId(req.params.jobId));
      const body: JobStatusResponse = {
        jobId: job.id,
        status: job.status,
        updatedAt: job.updatedAt,
        history: job.history,
      };
      res.status(200).json(body);
    } catch (err) {
      next(err);
    }
  };

  cancel = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const jobId = asJobId(req.params.jobId as string);
      const request = req.body as CancelJobRequest;
      const result: CancelJobResponse = await this.jobService.cancelJob(jobId, request);
      res.status(200).json(result);
    } catch (err) {
      next(err);
    }
  };
}

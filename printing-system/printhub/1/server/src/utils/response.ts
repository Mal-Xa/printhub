import { Response } from 'express';
import { ApiResponse } from '../types';

export function ok<T>(res: Response, data: T, message?: string, statusCode = 200): void {
  const body: ApiResponse<T> = { success: true, data, message };
  res.status(statusCode).json(body);
}

export function created<T>(res: Response, data: T, message?: string): void {
  ok(res, data, message, 201);
}

export function noContent(res: Response): void {
  res.status(204).send();
}

export function fail(res: Response, message: string, statusCode = 500, error?: string): void {
  const body: ApiResponse = { success: false, message, error };
  res.status(statusCode).json(body);
}

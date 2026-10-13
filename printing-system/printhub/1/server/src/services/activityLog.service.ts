import { ActivityLogRepository } from '../repositories/activityLog.repository';
import { ActivityLog, ActivityAction } from '../types';
import { generateId, nowISO } from '../utils/id';

interface LogParams {
  action: ActivityAction;
  userId: string;
  targetId?: string;
  targetType?: string;
  metadata?: Record<string, unknown>;
}

export const ActivityLogService = {
  async log(params: LogParams): Promise<ActivityLog> {
    const log: ActivityLog = {
      id: generateId(),
      ...params,
      createdAt: nowISO(),
    };
    return ActivityLogRepository.create(log);
  },

  async getAll(limit?: number): Promise<ActivityLog[]> {
    return ActivityLogRepository.findAll(limit);
  },

  async getByUser(userId: string, limit?: number): Promise<ActivityLog[]> {
    return ActivityLogRepository.findByUser(userId, limit);
  },
};

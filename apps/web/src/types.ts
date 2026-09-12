export type {
  Role,
  Semantic,
  User,
  Member,
  Space,
  Status,
  ChecklistItem,
  Task,
  Activity,
  Execution,
  Board,
  TaskDetail,
} from '@taskboard/core';
export interface ApiFault {
  code: string;
  message: string;
  details?: unknown;
  status: number;
}

export type TaskType = "ielts" | "competition" | "course" | "other";
export type TaskPriority = "low" | "medium" | "high" | "urgent";
export type TaskStatus = "not_started" | "completed" | "incomplete" | "cancelled";
export type CourseTaskType = "assignment" | "test" | "exam" | "report" | "other";

export interface Task {
  schemaVersion: number;
  recordId: string;
  entityType: "task";
  title: string;
  taskType: TaskType;
  sourceModule: string;
  description: string;
  tags: string[];
  priority: TaskPriority;
  status: TaskStatus;
  startAt: string | null;
  dueAt: string | null;
  reminderAt: string | null;
  createdAt: string;
  updatedAt: string;
  deletedAt: string | null;
  notes: string;
  courseId: string | null;
  courseTaskType: CourseTaskType | null;
  customCourseTaskType: string | null;
  assetRefs: string[];
  sourceImportId: string | null;
  contentHash: string;
}

export interface TaskInput {
  title: string;
  taskType: TaskType;
  description: string;
  tags: string[];
  priority: TaskPriority;
  startAt: string | null;
  dueAt: string | null;
  reminderAt: string | null;
  notes: string;
  courseId: string | null;
  courseTaskType: CourseTaskType | null;
  customCourseTaskType: string | null;
}

export interface TaskFilters {
  query: string;
  type: TaskType | "all";
  status: TaskStatus | "all";
}

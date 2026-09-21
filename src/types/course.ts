export interface Course {
  schemaVersion: number;
  recordId: string;
  entityType: "course";
  name: string;
  teacher: string;
  classroom: string;
  weekday: number;
  startSection: number;
  endSection: number;
  startTime: string;
  endTime: string;
  startWeek: number;
  endWeek: number;
  color: string;
  createdAt: string;
  updatedAt: string;
  deletedAt: string | null;
  contentHash: string;
  scheduleId: string;
}

export type CourseInput = Pick<Course, "name" | "teacher" | "classroom" | "weekday" | "startSection" | "endSection" | "startTime" | "endTime" | "startWeek" | "endWeek" | "color">;
export type CourseUpdateInput = CourseInput & { scopeWeeks?: number[] };

export interface ScheduleSettings {
  semesterStartDate: string;
}

export interface ScheduleRoutine { section: number; startTime: string; endTime: string; }
export interface Schedule { id: string; name: string; semesterStartDate: string; color: string; routines: ScheduleRoutine[]; }
export type ScheduleUpdateInput = Pick<Schedule, "name" | "semesterStartDate" | "color" | "routines">;
export interface ScheduleImportInput { scheduleId?: string | null; scheduleName: string; semesterStartDate: string; color: string; mode: "append" | "replace"; courses: CourseInput[]; }

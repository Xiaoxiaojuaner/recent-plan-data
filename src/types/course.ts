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
}

export type CourseInput = Pick<Course, "name" | "teacher" | "classroom" | "weekday" | "startSection" | "endSection" | "startTime" | "endTime" | "startWeek" | "endWeek" | "color">;

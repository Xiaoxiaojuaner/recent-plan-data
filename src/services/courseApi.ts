import { invoke } from "@tauri-apps/api/core";
import { z } from "zod";
import type { Course, CourseInput } from "../types/course";

const courseSchema = z.object({
  schemaVersion: z.number(), recordId: z.string(), entityType: z.literal("course"), name: z.string(),
  teacher: z.string(), classroom: z.string(), weekday: z.number(), startSection: z.number(), endSection: z.number(),
  startTime: z.string(), endTime: z.string(), startWeek: z.number(), endWeek: z.number(), color: z.string(),
  createdAt: z.string(), updatedAt: z.string(), deletedAt: z.string().nullable(), contentHash: z.string(),
});

export const courseApi = {
  async list(): Promise<Course[]> { return z.array(courseSchema).parse(await invoke("course_list")); },
  async import(courses: CourseInput[]): Promise<Course[]> { return z.array(courseSchema).parse(await invoke("course_import", { courses })); },
};

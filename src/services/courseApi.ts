import { invoke } from "@tauri-apps/api/core";
import { z } from "zod";
import type { Course, CourseInput, CourseUpdateInput, Schedule, ScheduleImportInput, ScheduleSettings, ScheduleUpdateInput } from "../types/course";

const courseSchema = z.object({
  schemaVersion: z.number(), recordId: z.string(), entityType: z.literal("course"), name: z.string(),
  teacher: z.string(), classroom: z.string(), weekday: z.number(), startSection: z.number(), endSection: z.number(),
  startTime: z.string(), endTime: z.string(), startWeek: z.number(), endWeek: z.number(), color: z.string(),
  createdAt: z.string(), updatedAt: z.string(), deletedAt: z.string().nullable(), contentHash: z.string(), scheduleId: z.string(),
});
const settingsSchema = z.object({ semesterStartDate: z.string() });
const scheduleSchema = z.object({ id: z.string(), name: z.string(), semesterStartDate: z.string(), color: z.string(), routines: z.array(z.object({ section: z.number(), startTime: z.string(), endTime: z.string() })).default([]) });

export const courseApi = {
  async list(): Promise<Course[]> { return z.array(courseSchema).parse(await invoke("course_list")); },
  async import(courses: CourseInput[]): Promise<Course[]> { return z.array(courseSchema).parse(await invoke("course_import", { courses })); },
  async getSettings(): Promise<ScheduleSettings> { return settingsSchema.parse(await invoke("schedule_settings_get")); },
  async saveSettings(semesterStartDate: string): Promise<ScheduleSettings> { return settingsSchema.parse(await invoke("schedule_settings_save", { semesterStartDate })); },
  async listSchedules(): Promise<Schedule[]> { return z.array(scheduleSchema).parse(await invoke("schedule_list")); },
  async importSchedule(input: ScheduleImportInput): Promise<Course[]> { return z.array(courseSchema).parse(await invoke("schedule_import", { input })); },
  async deleteSchedule(id: string): Promise<void> { await invoke("schedule_delete", { id }); },
  async updateSchedule(id: string, input: ScheduleUpdateInput): Promise<Schedule> { return scheduleSchema.parse(await invoke("schedule_update", { id, input })); },
  async updateCourse(id: string, input: CourseUpdateInput): Promise<Course[]> { return z.array(courseSchema).parse(await invoke("course_update", { id, input })); },
};

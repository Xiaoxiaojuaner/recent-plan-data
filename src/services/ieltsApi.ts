import { invoke } from "@tauri-apps/api/core";
import { z } from "zod";
import type { IeltsCompletionInput, IeltsCourse, IeltsCourseInput, IeltsData, IeltsGoal, IeltsMock, IeltsScores, IeltsWork } from "../types/ielts";

const goalSchema = z.object({ reading: z.number(), listening: z.number(), writing: z.number(), speaking: z.number(), updatedAt: z.string() });
const workSchema = z.object({ recordId: z.string(), name: z.string(), category: z.enum(["reading", "listening", "writing", "speaking"]), dueAt: z.string().nullable(), expectedMinutes: z.number().nullable(), completedAt: z.string().nullable(), actualMinutes: z.number().nullable(), score: z.number().nullable(), readingCorrect: z.array(z.number()).nullable(), readingTotals: z.array(z.number()).nullable(), listeningCorrect: z.array(z.number()).nullable(), listeningTotals: z.array(z.number()).nullable(), deletedAt: z.string().nullable(), createdAt: z.string(), updatedAt: z.string() });
const mockSchema = z.object({ recordId: z.string(), examAt: z.string(), reading: z.number(), listening: z.number(), writing: z.number(), speaking: z.number(), notes: z.string(), createdAt: z.string(), updatedAt: z.string() });
const courseSchema = z.object({ recordId: z.string(), name: z.string(), startAt: z.string(), endAt: z.string(), teacher: z.string(), classroom: z.string(), color: z.string(), notes: z.string(), createdAt: z.string(), updatedAt: z.string() });
const dataSchema = z.object({ goal: goalSchema.nullable(), works: z.array(workSchema), mocks: z.array(mockSchema), courses: z.array(courseSchema), readWarnings: z.array(z.string()) });

export const ieltsApi = {
  async get(): Promise<IeltsData> { return dataSchema.parse(await invoke("ielts_get")); },
  async saveGoal(scores: IeltsScores): Promise<IeltsGoal> { return goalSchema.parse(await invoke("ielts_save_goal", { scores })); },
  async createWork(input: { name: string; category: string; dueAt: string | null; expectedMinutes: number | null }): Promise<IeltsWork> { return workSchema.parse(await invoke("ielts_create_work", { input })); },
  async completeWork(id: string, input: IeltsCompletionInput): Promise<IeltsWork> { return workSchema.parse(await invoke("ielts_complete_work", { id, input })); },
  async updateWorkResult(id: string, input: IeltsCompletionInput): Promise<IeltsWork> { return workSchema.parse(await invoke("ielts_update_work_result", { id, input })); },
  async deleteWork(id: string): Promise<IeltsWork> { return workSchema.parse(await invoke("ielts_delete_work", { id })); },
  async restoreWork(id: string): Promise<IeltsWork> { return workSchema.parse(await invoke("ielts_restore_work", { id })); },
  async createMock(input: Omit<IeltsMock, "recordId" | "createdAt" | "updatedAt">): Promise<IeltsMock> { return mockSchema.parse(await invoke("ielts_create_mock", { input })); },
  async importCourses(courses: IeltsCourseInput[]): Promise<IeltsCourse[]> { return z.array(courseSchema).parse(await invoke("ielts_import_courses", { courses })); },
};

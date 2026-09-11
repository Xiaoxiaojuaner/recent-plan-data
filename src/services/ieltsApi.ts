import { invoke } from "@tauri-apps/api/core";
import { z } from "zod";
import type { IeltsData, IeltsGoal, IeltsMock, IeltsScores, IeltsWork } from "../types/ielts";

const goalSchema = z.object({ reading: z.number(), listening: z.number(), writing: z.number(), speaking: z.number(), updatedAt: z.string() });
const workSchema = z.object({ recordId: z.string(), name: z.string(), category: z.enum(["reading", "listening", "writing", "speaking"]), dueAt: z.string().nullable(), expectedMinutes: z.number().nullable(), completedAt: z.string().nullable(), actualMinutes: z.number().nullable(), score: z.number().nullable(), readingCorrect: z.array(z.number()).nullable(), listeningCorrect: z.array(z.number()).nullable(), createdAt: z.string(), updatedAt: z.string() });
const mockSchema = z.object({ recordId: z.string(), examAt: z.string(), reading: z.number(), listening: z.number(), writing: z.number(), speaking: z.number(), notes: z.string(), createdAt: z.string(), updatedAt: z.string() });
const dataSchema = z.object({ goal: goalSchema.nullable(), works: z.array(workSchema), mocks: z.array(mockSchema) });

export const ieltsApi = {
  async get(): Promise<IeltsData> { return dataSchema.parse(await invoke("ielts_get")); },
  async saveGoal(scores: IeltsScores): Promise<IeltsGoal> { return goalSchema.parse(await invoke("ielts_save_goal", { scores })); },
  async createWork(input: { name: string; category: string; dueAt: string | null; expectedMinutes: number | null }): Promise<IeltsWork> { return workSchema.parse(await invoke("ielts_create_work", { input })); },
  async completeWork(id: string, input: { actualMinutes: number; score: number; readingCorrect: number[] | null; listeningCorrect: number[] | null }): Promise<IeltsWork> { return workSchema.parse(await invoke("ielts_complete_work", { id, input })); },
  async createMock(input: Omit<IeltsMock, "recordId" | "createdAt" | "updatedAt">): Promise<IeltsMock> { return mockSchema.parse(await invoke("ielts_create_mock", { input })); },
};

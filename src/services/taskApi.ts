import { invoke } from "@tauri-apps/api/core";
import { z } from "zod";
import type { Task, TaskInput, TaskStatus } from "../types/task";

const optionalString = z.string().nullable();
const taskSchema = z.object({
  schemaVersion: z.number(), recordId: z.string(), entityType: z.literal("task"), title: z.string(),
  taskType: z.enum(["ielts", "competition", "course", "other"]), sourceModule: z.string(),
  description: z.string(), tags: z.array(z.string()), priority: z.enum(["low", "medium", "high", "urgent"]),
  status: z.enum(["not_started", "completed", "incomplete", "cancelled"]), startAt: optionalString,
  dueAt: optionalString, reminderAt: optionalString, createdAt: z.string(), updatedAt: z.string(),
  deletedAt: optionalString, notes: z.string(), assetRefs: z.array(z.string()), sourceImportId: optionalString,
  courseId: optionalString,
  courseTaskType: z.enum(["assignment", "test", "exam", "report", "other"]).nullable(),
  customCourseTaskType: optionalString,
  contentHash: z.string(),
});

function explain(error: unknown): Error {
  return new Error(typeof error === "string" ? error : "本地数据操作失败，请重试");
}

export const taskApi = {
  async list(): Promise<Task[]> { try { return z.array(taskSchema).parse(await invoke("task_list")); } catch (error) { throw explain(error); } },
  async create(input: TaskInput): Promise<Task> { try { return taskSchema.parse(await invoke("task_create", { input })); } catch (error) { throw explain(error); } },
  async update(id: string, input: TaskInput): Promise<Task> { try { return taskSchema.parse(await invoke("task_update", { id, input })); } catch (error) { throw explain(error); } },
  async setStatus(id: string, status: TaskStatus): Promise<Task> { try { return taskSchema.parse(await invoke("task_set_status", { id, status })); } catch (error) { throw explain(error); } },
  async remove(id: string): Promise<void> { try { await invoke("task_delete", { id }); } catch (error) { throw explain(error); } },
};

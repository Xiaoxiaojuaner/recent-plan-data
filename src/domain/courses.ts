import { z } from "zod";
import type { CourseInput } from "../types/course";

const courseInputSchema = z.object({
  name: z.string().trim().min(1).max(120),
  teacher: z.string().default(""),
  classroom: z.string().default(""),
  weekday: z.number().int().min(1).max(7),
  startSection: z.number().int().min(1).max(20),
  endSection: z.number().int().min(1).max(20),
  startTime: z.string().default(""),
  endTime: z.string().default(""),
  startWeek: z.number().int().min(1).max(60),
  endWeek: z.number().int().min(1).max(60),
  color: z.string().regex(/^#[0-9a-fA-F]{6}$/).default("#6f8f7b"),
}).refine((course) => course.endSection >= course.startSection && course.endWeek >= course.startWeek);

const scheduleSchema = z.object({ schemaVersion: z.literal(1), courses: z.array(courseInputSchema).min(1) });

export function parseScheduleImport(content: string): CourseInput[] {
  const normalized = content.replace(/^\uFEFF/, "").trim();
  const fenced = normalized.match(/```(?:json)?\s*([\s\S]*?)```/i)?.[1]?.trim();
  const source = fenced ?? (() => {
    const start = normalized.indexOf("{");
    const end = normalized.lastIndexOf("}");
    return start >= 0 && end > start ? normalized.slice(start, end + 1) : normalized;
  })();

  let parsed: unknown;
  try {
    parsed = JSON.parse(source);
  } catch {
    throw new Error("没有找到有效 JSON。可以粘贴 AI 的完整回复，或只粘贴 { } 内的内容");
  }

  const result = scheduleSchema.safeParse(parsed);
  if (!result.success) {
    const issue = result.error.issues[0];
    const location = issue.path.length ? issue.path.join(" → ") : "根节点";
    throw new Error(`课表格式不正确：${location} 字段 ${issue.message}`);
  }
  return result.data.courses;
}

export const scheduleTemplate = JSON.stringify({
  schemaVersion: 1,
  courses: [{ name: "高等数学", teacher: "张老师", classroom: "教学楼 A101", weekday: 1, startSection: 1, endSection: 2, startTime: "08:00", endTime: "09:40", startWeek: 1, endWeek: 16, color: "#6f8f7b" }],
}, null, 2);

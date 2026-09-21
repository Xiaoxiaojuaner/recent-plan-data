import { z } from "zod";
import type { Course, CourseInput } from "../types/course";

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

export const routineTemplate = JSON.stringify({ schemaVersion: 1, routines: [{ section: 1, startTime: "08:00", endTime: "08:45" }, { section: 2, startTime: "08:55", endTime: "09:40" }] }, null, 2);
export const routineAiPrompt = `请根据我提供的学校作息截图或文字，提取每个节次的开始和结束时间。仅返回一个 JSON 对象，不要说明文字或 Markdown。节次从 1 开始且不得重复，时间使用 24 小时制 HH:mm，结束时间必须晚于开始时间。格式如下：\n${routineTemplate}`;

const routineSchema = z.object({ schemaVersion: z.literal(1), routines: z.array(z.object({ section: z.number().int().min(1).max(20), startTime: z.string().regex(/^\d{2}:\d{2}$/), endTime: z.string().regex(/^\d{2}:\d{2}$/) })).min(1) }).refine((value) => value.routines.every((item) => item.startTime < item.endTime) && new Set(value.routines.map((item) => item.section)).size === value.routines.length, "作息节次不可重复，且结束时间必须晚于开始时间");
export function parseRoutineImport(content: string) {
  const source = content.match(/```(?:json)?\s*([\s\S]*?)```/i)?.[1]?.trim() ?? content.trim();
  try { const result = routineSchema.safeParse(JSON.parse(source)); if (!result.success) throw new Error(result.error.issues[0]?.message); return result.data.routines.sort((a, b) => a.section - b.section); }
  catch (error) { throw new Error(`作息格式不正确：${error instanceof Error ? error.message : "请粘贴 JSON"}`); }
}

export function parseWeekSelection(value: string, start: number, end: number): number[] {
  const weeks = new Set<number>();
  for (const token of value.split(/[，,\s]+/).filter(Boolean)) { const match = token.match(/^(\d+)(?:-(\d+))?$/); if (!match) throw new Error("周次请写成 1,3-5 的格式"); const from = Number(match[1]), to = Number(match[2] ?? match[1]); if (from > to || from < start || to > end) throw new Error(`周次必须在 ${start}-${end} 周内`); for (let week = from; week <= to; week += 1) weeks.add(week); }
  if (!weeks.size) throw new Error("请至少选择一周"); return [...weeks].sort((a, b) => a - b);
}

export function getTeachingWeek(date: Date, semesterStartDate: string): number | null {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(semesterStartDate)) return null;
  const start = new Date(`${semesterStartDate}T00:00:00`);
  const current = new Date(date.getFullYear(), date.getMonth(), date.getDate());
  // 教学周按自然周（周一至周日）计。若开学日在周中，仍属于第一周，
  // 因此从该周周一开始计算，避免 9 月 1 日开学时 9 月 21 日被误显示为第 3 周。
  const mondayOffset = (start.getDay() + 6) % 7;
  start.setDate(start.getDate() - mondayOffset);
  const elapsedDays = Math.floor((current.getTime() - start.getTime()) / 86_400_000);
  return elapsedDays < 0 ? null : Math.floor(elapsedDays / 7) + 1;
}

export function coursesForTeachingWeek(courses: Course[], date: Date, semesterStartDate: string): Course[] {
  const week = getTeachingWeek(date, semesterStartDate);
  return week == null ? [] : courses.filter((course) => course.startWeek <= week && course.endWeek >= week);
}

export function hasActiveCourseOnDate(date: Date, courses: Course[], semesterStartDate: string): boolean {
  const weekday = date.getDay() === 0 ? 7 : date.getDay();
  return coursesForTeachingWeek(courses, date, semesterStartDate).some((course) => course.weekday === weekday);
}

export interface CourseSlotItem { course: Course; weekRanges: string[] }
export interface CourseSlot { weekday: number; startSection: number; endSection: number; items: CourseSlotItem[] }

export function courseSlots(courses: Course[]): CourseSlot[] {
  const slots = new Map<string, CourseSlot>();
  for (const course of courses) {
    const slotKey = `${course.weekday}-${course.startSection}-${course.endSection}`;
    const slot = slots.get(slotKey) ?? { weekday: course.weekday, startSection: course.startSection, endSection: course.endSection, items: [] };
    const identity = `${course.name}\u0000${course.teacher}\u0000${course.classroom}\u0000${course.color}`;
    const existing = slot.items.find((item) => `${item.course.name}\u0000${item.course.teacher}\u0000${item.course.classroom}\u0000${item.course.color}` === identity);
    const range = `${course.startWeek}-${course.endWeek}`;
    if (existing) existing.weekRanges.push(range);
    else slot.items.push({ course, weekRanges: [range] });
    slots.set(slotKey, slot);
  }
  return [...slots.values()].sort((a, b) => a.weekday - b.weekday || a.startSection - b.startSection);
}

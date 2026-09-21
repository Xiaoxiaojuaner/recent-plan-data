import { z } from "zod";
import type { IeltsCategory, IeltsCompletionInput, IeltsCourse, IeltsCourseInput, IeltsMock, IeltsScores, IeltsWork } from "../types/ielts";

const categories: IeltsCategory[] = ["reading", "listening", "writing", "speaking"];

export function filterWorks(works: IeltsWork[], category: IeltsCategory | "all"): IeltsWork[] {
  return category === "all" ? works : works.filter((work) => work.category === category);
}

export function sortCompletedWorks(works: IeltsWork[]): IeltsWork[] {
  return works.filter((work) => work.completedAt && !work.deletedAt).sort((a, b) => (b.completedAt ?? "").localeCompare(a.completedAt ?? ""));
}

export function recentCategoryAverages(works: IeltsWork[]): Record<IeltsCategory, number | null> {
  const completed = sortCompletedWorks(works);
  return Object.fromEntries(categories.map((category) => {
    const scores = completed.filter((work) => work.category === category && work.score != null).slice(0, 5).map((work) => work.score as number);
    return [category, scores.length ? Math.round(scores.reduce((sum, score) => sum + score, 0) / scores.length * 10) / 10 : null];
  })) as Record<IeltsCategory, number | null>;
}

export function latestMock(mocks: IeltsMock[]): IeltsMock | null {
  return [...mocks].sort((a, b) => b.examAt.localeCompare(a.examAt))[0] ?? null;
}

export function overallBandScore(scores: IeltsScores): number {
  const average = (scores.reading + scores.listening + scores.writing + scores.speaking) / 4;
  return Math.round(average * 2) / 2;
}

const ieltsCourseSchema = z.object({
  name: z.string().trim().min(1).max(120),
  startAt: z.string().min(1),
  endAt: z.string().min(1),
  teacher: z.string().default(""),
  classroom: z.string().default(""),
  color: z.string().regex(/^#[0-9a-fA-F]{6}$/).default("#6f8f7b"),
  notes: z.string().default(""),
}).refine((course) => course.endAt > course.startAt, { message: "结束时间必须晚于开始时间" });

const datedIeltsCourseSchema = z.object({
  name: z.string().trim().min(1).max(120),
  teacher: z.string().default(""),
  classroom: z.string().default(""),
  weekday: z.number().int().min(1).max(7).optional(),
  startTime: z.string().regex(/^\d{2}:\d{2}$/),
  endTime: z.string().regex(/^\d{2}:\d{2}$/),
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  color: z.string().regex(/^#[0-9a-fA-F]{6}$/).default("#6f8f7b"),
  notes: z.string().default(""),
}).refine((course) => course.endTime > course.startTime, { message: "结束时间必须晚于开始时间" });

const ieltsCourseImportSchema = z.object({ schemaVersion: z.literal(1), courses: z.array(z.union([ieltsCourseSchema, datedIeltsCourseSchema])).min(1) });

export function parseIeltsCourseImport(content: string): IeltsCourseInput[] {
  const normalized = content.replace(/^\uFEFF/, "").replace(/&#x20;|&#32;|&nbsp;/gi, " ").trim();
  const fenced = normalized.match(/```(?:json)?\s*([\s\S]*?)```/i)?.[1]?.trim();
  const source = fenced ?? normalized.slice(normalized.indexOf("{"), normalized.lastIndexOf("}") + 1);
  let parsed: unknown;
  try { parsed = JSON.parse(source); } catch { throw new Error("没有找到有效的雅思课程 JSON"); }
  const result = ieltsCourseImportSchema.safeParse(parsed);
  if (!result.success) throw new Error(`雅思课程格式不正确：${result.error.issues[0].message}`);
  return result.data.courses.map((course) => "date" in course ? {
    name: course.name,
    startAt: `${course.date}T${course.startTime}`,
    endAt: `${course.date}T${course.endTime}`,
    teacher: course.teacher,
    classroom: course.classroom,
    color: course.color,
    notes: course.notes,
  } : course);
}

export function sortIeltsCourses<T extends { startAt: string }>(courses: T[]): T[] {
  return [...courses].sort((a, b) => a.startAt.localeCompare(b.startAt));
}

export function hasIeltsCourseOnDate(date: Date, courses: IeltsCourse[]): boolean {
  return ieltsCourseNamesOnDate(date, courses).length > 0;
}

export function ieltsCourseNamesOnDate(date: Date, courses: IeltsCourse[]): string[] {
  const key = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
  return [...new Set(courses.filter((course) => course.startAt.slice(0, 10) === key).map((course) => course.name))];
}

const readingBandByRaw = [
  [39, 9], [37, 8.5], [35, 8], [33, 7.5], [30, 7], [27, 6.5], [23, 6], [19, 5.5], [15, 5], [13, 4.5], [10, 4], [8, 3.5], [6, 3], [4, 2.5], [3, 2], [2, 1.5], [1, 1], [0, 0],
] as const;

const listeningBandByRaw = [
  [39, 9], [37, 8.5], [35, 8], [32, 7.5], [30, 7], [26, 6.5], [23, 6], [18, 5.5], [16, 5], [13, 4.5], [11, 4], [8, 3.5], [6, 3], [4, 2.5], [3, 2], [2, 1.5], [1, 1], [0, 0],
] as const;

export function autoIeltsBandScore(category: "reading" | "listening", correct: number, total: number): number {
  if (!Number.isFinite(correct) || !Number.isFinite(total) || total <= 0 || correct < 0 || correct > total) throw new Error("答对数和总题数不正确");
  const normalizedRaw = Math.max(0, Math.min(40, Math.round(correct / total * 40)));
  const table = category === "reading" ? readingBandByRaw : listeningBandByRaw;
  return table.find(([minimum]) => normalizedRaw >= minimum)?.[1] ?? 0;
}

export function buildIeltsCompletion(category: IeltsCategory, actualMinutes: number, score: number | null, correctParts: Array<number | null>, readingTotals: number[]): IeltsCompletionInput {
  if (!Number.isFinite(actualMinutes) || actualMinutes <= 0) throw new Error("完成时间必须大于 0");
  if (category === "reading") {
    const completed = correctParts.slice(0, 3).map((correct, index) => ({ correct, total: readingTotals[index] })).filter((part) => part.correct != null);
    if (!completed.length) throw new Error("请至少填写一篇阅读");
    if (completed.some((part) => !Number.isInteger(part.correct) || (part.correct as number) < 0 || (part.correct as number) > 15 || !Number.isInteger(part.total) || part.total < 1 || part.total > 15 || (part.correct as number) > part.total)) throw new Error("每篇阅读答对数不能超过 15，也不能超过该篇总题数");
    const full = completed.length === 3;
    const automaticScore = full ? autoIeltsBandScore("reading", completed.reduce((sum, part) => sum + (part.correct as number), 0), completed.reduce((sum, part) => sum + part.total, 0)) : null;
    return { actualMinutes, score: automaticScore, readingCorrect: completed.map((part) => part.correct as number), readingTotals: completed.map((part) => part.total), listeningCorrect: null, listeningTotals: null };
  }
  if (category === "listening") {
    const completed = correctParts.slice(0, 4).map((correct, index) => ({ correct, total: readingTotals[index] })).filter((part) => part.correct != null);
    if (!completed.length) throw new Error("请至少填写一个听力部分");
    if (completed.some((part) => !Number.isInteger(part.correct) || (part.correct as number) < 0 || !Number.isInteger(part.total) || part.total < 1 || part.total > 10 || (part.correct as number) > part.total)) throw new Error("每个听力部分答对数不能超过该部分总题数，总题数最多 10");
    const automaticScore = completed.length === 4 ? autoIeltsBandScore("listening", completed.reduce((sum, part) => sum + (part.correct as number), 0), completed.reduce((sum, part) => sum + part.total, 0)) : null;
    return { actualMinutes, score: automaticScore, readingCorrect: null, readingTotals: null, listeningCorrect: completed.map((part) => part.correct as number), listeningTotals: completed.map((part) => part.total) };
  }
  if (score == null || score < 0 || score > 9) throw new Error("请填写 0 到 9 分的成绩");
  return { actualMinutes, score, readingCorrect: null, readingTotals: null, listeningCorrect: null, listeningTotals: null };
}

export function workResultSummary(work: IeltsWork): string | null {
  if (work.readingCorrect?.length && work.readingTotals?.length) {
    const raw = `答对 ${work.readingCorrect.reduce((sum, value) => sum + value, 0)} / ${work.readingTotals.reduce((sum, value) => sum + value, 0)} 题`;
    return work.score == null ? raw : `${work.score} 分 · ${raw}`;
  }
  if (work.listeningCorrect?.length && work.listeningTotals?.length) {
    const raw = `答对 ${work.listeningCorrect.reduce((sum, value) => sum + value, 0)} / ${work.listeningTotals.reduce((sum, value) => sum + value, 0)} 题`;
    return work.score == null ? raw : `${work.score} 分 · ${raw}`;
  }
  if (work.score != null) return `${work.score} 分`;
  return null;
}

export function workTimeProgress(work: Pick<IeltsWork, "actualMinutes" | "expectedMinutes">): number {
  if (!work.actualMinutes || !work.expectedMinutes || work.expectedMinutes <= 0) return 0;
  return Math.min(360, Math.max(0, work.actualMinutes / work.expectedMinutes * 360));
}

export function splitWorksByTrash(works: IeltsWork[]): { active: IeltsWork[]; trash: IeltsWork[] } {
  return { active: works.filter((work) => !work.deletedAt), trash: works.filter((work) => work.deletedAt) };
}

export const ieltsCourseTemplate = JSON.stringify({
  schemaVersion: 1,
  courses: [{ name: "听力", teacher: "刘老师", classroom: "天河校区", weekday: 6, startTime: "10:00", endTime: "12:00", date: "2026-09-12", color: "#6f8f7b" }],
}, null, 2);

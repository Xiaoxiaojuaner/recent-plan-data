import type { IeltsCategory, IeltsMock, IeltsWork } from "../types/ielts";

const categories: IeltsCategory[] = ["reading", "listening", "writing", "speaking"];

export function filterWorks(works: IeltsWork[], category: IeltsCategory | "all"): IeltsWork[] {
  return category === "all" ? works : works.filter((work) => work.category === category);
}

export function sortCompletedWorks(works: IeltsWork[]): IeltsWork[] {
  return works.filter((work) => work.completedAt).sort((a, b) => (b.completedAt ?? "").localeCompare(a.completedAt ?? ""));
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

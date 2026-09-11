import { describe, expect, it } from "vitest";
import { filterWorks, latestMock, recentCategoryAverages, sortCompletedWorks } from "./ielts";
import type { IeltsMock, IeltsWork } from "../types/ielts";

function work(index: number, category: IeltsWork["category"], score: number): IeltsWork {
  return { recordId: String(index), name: `练习 ${index}`, category, dueAt: null, expectedMinutes: null,
    completedAt: `2026-09-${String(index).padStart(2, "0")}T10:00`, actualMinutes: 30,
    score, readingCorrect: null, listeningCorrect: null, createdAt: "", updatedAt: "" };
}

describe("IELTS summaries", () => {
  it("averages only the latest five completed works per category", () => {
    const works = [1, 2, 3, 4, 5, 6].map((index) => work(index, "reading", index));
    expect(recentCategoryAverages(works).reading).toBe(4);
  });

  it("sorts completed works and mock exams newest first", () => {
    const works = [work(1, "listening", 6), work(3, "listening", 7), work(2, "listening", 6.5)];
    expect(sortCompletedWorks(works)[0].recordId).toBe("3");
    const mocks = [{ recordId: "old", examAt: "2026-08-01" }, { recordId: "new", examAt: "2026-09-01" }] as IeltsMock[];
    expect(latestMock(mocks)?.recordId).toBe("new");
  });

  it("filters homework by IELTS category while keeping all available", () => {
    const works = [work(1, "reading", 6), work(2, "listening", 7)];
    expect(filterWorks(works, "all")).toHaveLength(2);
    expect(filterWorks(works, "reading").map((item) => item.recordId)).toEqual(["1"]);
  });
});

import { describe, expect, it } from "vitest";
import { autoIeltsBandScore, buildIeltsCompletion, filterWorks, hasIeltsCourseOnDate, ieltsCourseNamesOnDate, latestMock, overallBandScore, parseIeltsCourseImport, splitWorksByTrash, sortCompletedWorks, sortIeltsCourses, recentCategoryAverages, workResultSummary, workTimeProgress } from "./ielts";
import type { IeltsCourse, IeltsMock, IeltsWork } from "../types/ielts";

function work(index: number, category: IeltsWork["category"], score: number): IeltsWork {
  return { recordId: String(index), name: `练习 ${index}`, category, dueAt: null, expectedMinutes: null,
    completedAt: `2026-09-${String(index).padStart(2, "0")}T10:00`, actualMinutes: 30,
    score, readingCorrect: null, readingTotals: null, listeningCorrect: null, listeningTotals: null, deletedAt: null, createdAt: "", updatedAt: "" };
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

  it("calculates the IELTS overall score to the nearest half band", () => {
    expect(overallBandScore({ reading: 7, listening: 7, writing: 6.5, speaking: 6.5 })).toBe(7);
    expect(overallBandScore({ reading: 6, listening: 6, writing: 6, speaking: 6.5 })).toBe(6);
  });

  it("imports IELTS courses and sorts them by lesson time", () => {
    const imported = parseIeltsCourseImport(JSON.stringify({ schemaVersion: 1, courses: [
      { name: "口语小班", startAt: "2026-09-20T19:00", endAt: "2026-09-20T20:30", teacher: "Alex", notes: "" },
      { name: "阅读精讲", startAt: "2026-09-18T09:00", endAt: "2026-09-18T10:30", teacher: "", notes: "" },
    ] }));
    expect(sortIeltsCourses(imported)[0].name).toBe("阅读精讲");
  });

  it("accepts date plus start/end time and HTML-space entities from an AI reply", () => {
    const content = `{
      &#x20;"schemaVersion": 1,
      &#x20;"courses": [{
        "name": "听力", "teacher": "刘娟娟", "classroom": "天河维多利校区",
        "weekday": 6, "startTime": "10:00", "endTime": "12:00",
        "date": "2026-09-12", "color": "#6f8f7b"
      }]
    }`;
    const [course] = parseIeltsCourseImport(content);
    expect(course.startAt).toBe("2026-09-12T10:00");
    expect(course.endAt).toBe("2026-09-12T12:00");
    expect(course.classroom).toBe("天河维多利校区");
  });

  it("marks only the exact dates containing an IELTS course", () => {
    const courses = [{ startAt: "2026-09-12T10:00", name: "听力" }, { startAt: "2026-09-12T13:30", name: "阅读" }] as IeltsCourse[];
    expect(hasIeltsCourseOnDate(new Date(2026, 8, 12), courses)).toBe(true);
    expect(hasIeltsCourseOnDate(new Date(2026, 8, 13), courses)).toBe(false);
    expect(ieltsCourseNamesOnDate(new Date(2026, 8, 12), courses)).toEqual(["听力", "阅读"]);
  });

  it("allows one or two reading passages without producing a band score", () => {
    const result = buildIeltsCompletion("reading", 35, 6.5, [11, 9, null], [13, 13, 14]);
    expect(result.score).toBeNull();
    expect(result.readingCorrect).toEqual([11, 9]);
    expect(result.readingTotals).toEqual([13, 13]);
    expect(workResultSummary({ ...work(1, "reading", 6), ...result, completedAt: "2026-09-12" })).toBe("答对 20 / 26 题");
  });

  it("caps reading passages at 15 and listening sections at 10 correct answers", () => {
    expect(() => buildIeltsCompletion("reading", 30, 6.5, [16, null, null], [15, 13, 14])).toThrow("15");
    expect(() => buildIeltsCompletion("listening", 20, 6.5, [11, null, null, null], [10, 10, 10, 10])).toThrow("10");
  });

  it("shows correct and total questions for partial listening practice", () => {
    const result = buildIeltsCompletion("listening", 20, 6.5, [7, 6, null, null], [8, 9, 10, 10]);
    expect(result.score).toBeNull();
    expect(result.listeningTotals).toEqual([8, 9]);
    expect(workResultSummary({ ...work(1, "listening", 6), ...result, completedAt: "2026-09-12" })).toBe("答对 13 / 17 题");
  });

  it("automatically converts completed reading and listening results to IELTS bands", () => {
    expect(autoIeltsBandScore("reading", 30, 40)).toBe(7);
    expect(autoIeltsBandScore("listening", 30, 40)).toBe(7);
    expect(autoIeltsBandScore("reading", 15, 20)).toBe(7);

    const reading = buildIeltsCompletion("reading", 60, null, [10, 10, 10], [13, 13, 14]);
    const listening = buildIeltsCompletion("listening", 30, null, [8, 7, 7, 8], [10, 10, 10, 10]);
    expect(reading.score).toBe(7);
    expect(listening.score).toBe(7);
  });

  it("separates soft-deleted work into a recoverable trash list", () => {
    const active = work(1, "reading", 6), deleted = { ...work(2, "listening", 7), deletedAt: "2026-09-12T10:00" };
    expect(splitWorksByTrash([active, deleted]).active.map((item) => item.recordId)).toEqual(["1"]);
    expect(splitWorksByTrash([active, deleted]).trash.map((item) => item.recordId)).toEqual(["2"]);
    expect(sortCompletedWorks([active, deleted]).map((item) => item.recordId)).toEqual(["1"]);
  });

  it("calculates the inner time ring from actual and expected minutes", () => {
    expect(workTimeProgress({ actualMinutes: 30, expectedMinutes: 60 })).toBe(180);
    expect(workTimeProgress({ actualMinutes: 90, expectedMinutes: 60 })).toBe(360);
    expect(workTimeProgress({ actualMinutes: 30, expectedMinutes: null })).toBe(0);
  });
});

import { describe, expect, it } from "vitest";
import { canQuickComplete, createCourseTaskDraft, getDashboardGroups, getMonthCells, groupTasksByType, isTaskOverdue, matchesTask } from "./tasks";
import type { Task } from "../types/task";

const baseTask: Task = {
  schemaVersion: 1,
  recordId: "00000000-0000-4000-8000-000000000001",
  entityType: "task",
  title: "完成阅读练习",
  taskType: "ielts",
  sourceModule: "task",
  description: "Cambridge 18",
  tags: ["阅读"],
  priority: "high",
  status: "not_started",
  startAt: null,
  dueAt: "2026-09-11T20:00",
  reminderAt: null,
  createdAt: "2026-09-10T10:00:00+08:00",
  updatedAt: "2026-09-10T10:00:00+08:00",
  deletedAt: null,
  notes: "",
  courseId: null,
  courseTaskType: null,
  customCourseTaskType: null,
  assetRefs: [],
  sourceImportId: null,
  contentHash: "hash",
};

describe("task date rules", () => {
  const now = new Date("2026-09-11T12:00:00+08:00");

  it("groups today, next seven days and overdue tasks", () => {
    const tasks = [
      baseTask,
      { ...baseTask, recordId: "2", title: "明天", dueAt: "2026-09-12T09:00" },
      { ...baseTask, recordId: "3", title: "逾期", dueAt: "2026-09-10T09:00" },
    ];
    const groups = getDashboardGroups(tasks, now);
    expect(groups.today.map((task) => task.title)).toEqual(["完成阅读练习"]);
    expect(groups.upcoming.map((task) => task.title)).toEqual(["明天"]);
    expect(groups.overdue.map((task) => task.title)).toEqual(["逾期"]);
  });

  it("does not mark completed or cancelled tasks overdue", () => {
    expect(isTaskOverdue({ ...baseTask, dueAt: "2026-09-10", status: "completed" }, now)).toBe(false);
    expect(isTaskOverdue({ ...baseTask, dueAt: "2026-09-10", status: "cancelled" }, now)).toBe(false);
  });
});

describe("task filtering", () => {
  it("searches title, description and tags and respects filters", () => {
    expect(matchesTask(baseTask, { query: "阅读", type: "all", status: "all" })).toBe(true);
    expect(matchesTask(baseTask, { query: "Cambridge", type: "all", status: "all" })).toBe(true);
    expect(matchesTask(baseTask, { query: "", type: "course", status: "all" })).toBe(false);
    expect(matchesTask(baseTask, { query: "", type: "ielts", status: "not_started" })).toBe(true);
  });
});

describe("calendar", () => {
  it("builds complete weeks and maps tasks to their due date", () => {
    const cells = getMonthCells(2026, 8, [baseTask]);
    expect(cells.length % 7).toBe(0);
    expect(cells.find((cell) => cell.dateKey === "2026-09-11")?.tasks).toHaveLength(1);
  });

});

describe("task grouping", () => {
  it("groups tasks by top-level task type", () => {
    const grouped = groupTasksByType([baseTask, { ...baseTask, recordId: "2", taskType: "course" }]);
    expect(grouped.ielts).toHaveLength(1);
    expect(grouped.course).toHaveLength(1);
  });

  it("hides quick completion for IELTS and competition tasks", () => {
    expect(canQuickComplete("ielts")).toBe(false);
    expect(canQuickComplete("competition")).toBe(false);
    expect(canQuickComplete("course")).toBe(true);
  });
});

describe("course task draft", () => {
  it("links the clicked course, defaults to assignment and uses the creation time", () => {
    const draft = createCourseTaskDraft("course-1", new Date(2026, 8, 11, 14, 5));
    expect(draft.courseId).toBe("course-1");
    expect(draft.courseTaskType).toBe("assignment");
    expect(draft.startAt).toBe("2026-09-11T14:05");
    expect(draft.notes).toBe("");
  });
});

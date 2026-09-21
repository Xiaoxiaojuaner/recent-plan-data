import type { Task, TaskFilters, TaskInput, TaskType } from "../types/task";

export function dateKey(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

export function taskDateKey(task: Task): string | null {
  return task.dueAt?.slice(0, 10) ?? task.startAt?.slice(0, 10) ?? null;
}

export function isTaskOverdue(task: Task, now = new Date()): boolean {
  if (!task.dueAt || task.status === "completed" || task.status === "cancelled") return false;
  return new Date(task.dueAt).getTime() < now.getTime();
}

export function getDashboardGroups(tasks: Task[], now = new Date()) {
  const todayKey = dateKey(now);
  const tomorrow = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1);
  const sevenDays = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 7, 23, 59, 59);
  const active = tasks.filter((task) => task.status !== "cancelled");
  const byDue = (a: Task, b: Task) => (a.dueAt ?? "9999").localeCompare(b.dueAt ?? "9999");
  return {
    today: active.filter((task) => taskDateKey(task) === todayKey).sort(byDue),
    upcoming: active.filter((task) => {
      if (!task.dueAt || task.status === "completed") return false;
      const due = new Date(task.dueAt);
      return due >= tomorrow && due <= sevenDays;
    }).sort(byDue),
    overdue: active.filter((task) => isTaskOverdue(task, now)).sort(byDue),
  };
}

export function matchesTask(task: Task, filters: TaskFilters): boolean {
  const query = filters.query.trim().toLocaleLowerCase();
  const haystack = [task.title, task.description, task.notes, ...task.tags].join(" ").toLocaleLowerCase();
  return (!query || haystack.includes(query))
    && (filters.type === "all" || task.taskType === filters.type)
    && (filters.status === "all" || task.status === filters.status);
}

export function groupTasksByType(tasks: Task[]): Record<TaskType, Task[]> {
  return {
    ielts: tasks.filter((task) => task.taskType === "ielts"),
    competition: tasks.filter((task) => task.taskType === "competition"),
    course: tasks.filter((task) => task.taskType === "course"),
    other: tasks.filter((task) => task.taskType === "other"),
  };
}

export function canQuickComplete(taskType: TaskType): boolean {
  return taskType !== "ielts" && taskType !== "competition";
}

function localDateTimeValue(date: Date): string {
  const shifted = new Date(date.getTime() - date.getTimezoneOffset() * 60_000);
  return shifted.toISOString().slice(0, 16);
}

export function createCourseTaskDraft(courseId: string, now = new Date()): TaskInput {
  return {
    title: "",
    taskType: "course",
    description: "",
    tags: [],
    priority: "medium",
    startAt: localDateTimeValue(now),
    dueAt: null,
    reminderAt: null,
    notes: "",
    courseId,
    courseTaskType: "assignment",
    customCourseTaskType: null,
  };
}

export interface CalendarCell { date: Date; dateKey: string; inMonth: boolean; tasks: Task[] }

export function getMonthCells(year: number, month: number, tasks: Task[]): CalendarCell[] {
  const first = new Date(year, month, 1);
  const mondayOffset = (first.getDay() + 6) % 7;
  const start = new Date(year, month, 1 - mondayOffset);
  const last = new Date(year, month + 1, 0);
  const lastOffset = 6 - ((last.getDay() + 6) % 7);
  const count = Math.ceil((mondayOffset + last.getDate() + lastOffset) / 7) * 7;
  return Array.from({ length: count }, (_, index) => {
    const date = new Date(start.getFullYear(), start.getMonth(), start.getDate() + index);
    const key = dateKey(date);
    return { date, dateKey: key, inMonth: date.getMonth() === month, tasks: tasks.filter((task) => taskDateKey(task) === key && task.status !== "cancelled") };
  });
}

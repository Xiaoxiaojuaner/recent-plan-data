import { describe, expect, it } from "vitest";
import { courseSlots, coursesForTeachingWeek, getTeachingWeek, hasActiveCourseOnDate, parseRoutineImport, parseScheduleImport, parseWeekSelection } from "./courses";
import type { Course } from "../types/course";

describe("schedule import", () => {
  it("accepts the documented AI schedule template", () => {
    const result = parseScheduleImport(JSON.stringify({
      schemaVersion: 1,
      courses: [{ name: "高等数学", teacher: "张老师", classroom: "A101", weekday: 1, startSection: 1, endSection: 2, startTime: "08:00", endTime: "09:40", startWeek: 1, endWeek: 16, color: "#6f8f7b" }],
    }));
    expect(result).toHaveLength(1);
    expect(result[0].name).toBe("高等数学");
  });

  it("rejects invalid weekdays, sections and week ranges", () => {
    const invalid = JSON.stringify({ schemaVersion: 1, courses: [{ name: "课程", weekday: 8, startSection: 3, endSection: 2, startWeek: 10, endWeek: 1 }] });
    expect(() => parseScheduleImport(invalid)).toThrow("课表格式不正确");
  });

  it("extracts JSON from a complete AI markdown response", () => {
    const response = `已按课程表整理。由于原图未提供具体上下课时间，时间暂留空。
\`\`\`json
{
  "schemaVersion": 1,
  "courses": [{
    "name": "数字信号处理",
    "teacher": "宁更新",
    "classroom": "广州国际校区 F3-a201",
    "weekday": 1,
    "startSection": 1,
    "endSection": 2,
    "startTime": "",
    "endTime": "",
    "startWeek": 1,
    "endWeek": 13,
    "color": "#6f8f7b"
  }]
}
\`\`\``;
    expect(parseScheduleImport(response)[0].name).toBe("数字信号处理");
  });

  it("maps calendar dates to teaching weeks from the selected first Monday", () => {
    expect(getTeachingWeek(new Date(2026, 8, 7), "2026-09-07")).toBe(1);
    expect(getTeachingWeek(new Date(2026, 8, 20), "2026-09-07")).toBe(2);
    expect(getTeachingWeek(new Date(2026, 8, 6), "2026-09-07")).toBeNull();
  });

  it("supports September 1 as the first day of teaching week one", () => {
    expect(getTeachingWeek(new Date(2026, 8, 1), "2026-09-01")).toBe(1);
    expect(getTeachingWeek(new Date(2026, 8, 8), "2026-09-01")).toBe(2);
  });

  it("marks only dates whose weekday and teaching-week range both match", () => {
    const course = { weekday: 5, startWeek: 2, endWeek: 3 } as Course;
    expect(hasActiveCourseOnDate(new Date(2026, 8, 18), [course], "2026-09-07")).toBe(true);
    expect(hasActiveCourseOnDate(new Date(2026, 9, 2), [course], "2026-09-07")).toBe(false);
  });

  it("shows only courses active in the current teaching week", () => {
    const courses = [{ recordId: "early", startWeek: 1, endWeek: 2 }, { recordId: "late", startWeek: 3, endWeek: 8 }] as Course[];
    expect(coursesForTeachingWeek(courses, new Date(2026, 8, 21), "2026-09-07").map((course) => course.recordId)).toEqual(["late"]);
  });

  it("groups same timetable cells so disjoint-week courses cannot overprint", () => {
    const base = { weekday: 4, startSection: 5, endSection: 8, teacher: "涂老师", classroom: "F3", color: "#7088a0" };
    const courses = [
      { ...base, recordId: "1", name: "电磁场", startWeek: 4, endWeek: 9 },
      { ...base, recordId: "2", name: "电磁场", startWeek: 14, endWeek: 16 },
      { ...base, recordId: "3", name: "综合设计", startWeek: 2, endWeek: 3 },
    ] as Course[];
    const slots = courseSlots(courses);
    expect(slots).toHaveLength(1);
    expect(slots[0].items).toHaveLength(2);
    expect(slots[0].items[0].weekRanges).toEqual(["4-9", "14-16"]);
  });

  it("accepts an AI routine template and keeps sections ordered", () => {
    expect(parseRoutineImport(JSON.stringify({ schemaVersion: 1, routines: [{ section: 2, startTime: "08:55", endTime: "09:40" }, { section: 1, startTime: "08:00", endTime: "08:45" }] })).map((item) => item.section)).toEqual([1, 2]);
    expect(() => parseRoutineImport(JSON.stringify({ schemaVersion: 1, routines: [{ section: 1, startTime: "09:00", endTime: "08:00" }] }))).toThrow("作息格式不正确");
  });

  it("parses selected edit weeks and rejects weeks outside the original course", () => {
    expect(parseWeekSelection("1, 3-5", 1, 8)).toEqual([1, 3, 4, 5]);
    expect(() => parseWeekSelection("9", 1, 8)).toThrow("周次必须在 1-8 周内");
  });
});

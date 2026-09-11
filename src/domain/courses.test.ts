import { describe, expect, it } from "vitest";
import { parseScheduleImport } from "./courses";

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
});

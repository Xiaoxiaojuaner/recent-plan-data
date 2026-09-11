import { useCallback, useEffect, useMemo, useState } from "react";
import { BrowserRouter, NavLink, Route, Routes, useNavigate } from "react-router-dom";
import { canQuickComplete, createCourseTaskDraft, dateKey, getDashboardGroups, getMonthCells, groupTasksByType, hasCourseOnDate, isTaskOverdue, matchesTask } from "./domain/tasks";
import { parseScheduleImport, scheduleTemplate } from "./domain/courses";
import { courseApi } from "./services/courseApi";
import { taskApi } from "./services/taskApi";
import type { Course } from "./types/course";
import type { Task, TaskFilters, TaskInput, TaskPriority, TaskStatus, TaskType } from "./types/task";
import IeltsPage from "./IeltsPage";
import "./App.css";
import "./Course.css";

const typeLabels: Record<TaskType, string> = { ielts: "雅思", competition: "竞赛", course: "课程", other: "其他" };
const priorityLabels: Record<TaskPriority, string> = { low: "低", medium: "中", high: "高", urgent: "紧急" };
const statusLabels: Record<TaskStatus, string> = { not_started: "未开始", completed: "已完成", incomplete: "未完成", cancelled: "已取消" };
const courseTaskLabels: Record<string, string> = { assignment: "作业", test: "测试", exam: "考试", report: "报告", other: "其他" };

function formatDateTime(value: string | null) {
  if (!value) return "未设置时间";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value.replace("T", " ");
  return new Intl.DateTimeFormat("zh-CN", { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit", hour12: false }).format(date);
}

function Icon({ name }: { name: "home" | "tasks" | "calendar" | "course" | "plus" }) {
  const paths = {
    home: <><path d="M3 11.5 12 4l9 7.5"/><path d="M5 10.5V20h14v-9.5M9 20v-6h6v6"/></>,
    tasks: <><path d="M9 6h11M9 12h11M9 18h11"/><path d="m3.5 6 1 1 2-2M3.5 12l1 1 2-2M3.5 18l1 1 2-2"/></>,
    calendar: <><rect x="3" y="5" width="18" height="16" rx="2"/><path d="M16 3v4M8 3v4M3 10h18"/></>,
    course: <><path d="M4 5h16v14H4zM8 3v4M16 3v4M4 9h16"/><path d="M8 13h3M13 13h3M8 16h3"/></>,
    plus: <path d="M12 5v14M5 12h14"/>,
  };
  return <svg className="icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">{paths[name]}</svg>;
}

function EmptyState({ text, onAdd }: { text: string; onAdd: () => void }) {
  return <div className="empty"><div className="empty-mark">✓</div><p>{text}</p><button className="text-button" onClick={onAdd}>新增一项</button></div>;
}

function TaskRow({ task, onEdit, onStatus }: { task: Task; onEdit: (task: Task) => void; onStatus: (task: Task, status: TaskStatus) => void }) {
  const overdue = isTaskOverdue(task);
  return <article className={`task-row ${task.status === "completed" ? "is-complete" : ""}`}>
    {canQuickComplete(task.taskType) && <button className="check" aria-label={task.status === "completed" ? "设为未开始" : "完成任务"} onClick={() => onStatus(task, task.status === "completed" ? "not_started" : "completed")}>{task.status === "completed" ? "✓" : ""}</button>}
    <button className="task-main" onClick={() => onEdit(task)}><span className="task-title">{task.title}</span><span className="task-meta"><i className={`type-dot type-${task.taskType}`} />{typeLabels[task.taskType]}{task.courseTaskType ? ` · ${task.customCourseTaskType || courseTaskLabels[task.courseTaskType]}` : ""} · <span className={overdue ? "overdue" : ""}>{overdue ? "已逾期 · " : ""}{formatDateTime(task.dueAt)}</span></span></button>
    {task.taskType !== "course" && <span className={`priority priority-${task.priority}`}>{priorityLabels[task.priority]}</span>}
  </article>;
}

interface PageProps { tasks: Task[]; courses?: Course[]; onAdd: (dueAt?: string) => void; onEdit: (task: Task) => void; onStatus: (task: Task, status: TaskStatus) => void }

function Dashboard(props: PageProps) {
  const navigate = useNavigate();
  const groups = useMemo(() => getDashboardGroups(props.tasks), [props.tasks]);
  const pending = props.tasks.filter((task) => task.status === "not_started" || task.status === "incomplete").length;
  const completed = props.tasks.filter((task) => task.status === "completed").length;
  return <div className="page">
    <header className="page-header hero"><div><p className="eyebrow">今天也向前一步</p><h1>你好，欢迎回来</h1><p>这里是你近期规划的全貌。</p></div><button className="primary" onClick={() => props.onAdd()}><Icon name="plus" />新增任务</button></header>
    <section className="stats-grid"><div className="stat"><span>待完成</span><strong>{pending}</strong><small>所有进行中的任务</small></div><div className="stat accent"><span>今天</span><strong>{groups.today.length}</strong><small>需要在今天处理</small></div><div className="stat warning"><span>已逾期</span><strong>{groups.overdue.length}</strong><small>建议优先安排</small></div><div className="stat success"><span>已完成</span><strong>{completed}</strong><small>继续保持节奏</small></div></section>
    <div className="dashboard-grid">
      <section className="panel"><div className="panel-title"><div><span className="section-kicker">TODAY</span><h2>今日任务</h2></div><button className="text-button" onClick={() => navigate("/tasks")}>查看全部</button></div>{groups.today.length ? groups.today.map((task) => <TaskRow key={task.recordId} task={task} onEdit={props.onEdit} onStatus={props.onStatus} />) : <EmptyState text="今天还没有安排" onAdd={() => props.onAdd(`${dateKey(new Date())}T18:00`)} />}</section>
      <section className="panel"><div className="panel-title"><div><span className="section-kicker">NEXT 7 DAYS</span><h2>未来 7 天</h2></div></div>{groups.upcoming.length ? groups.upcoming.slice(0, 5).map((task) => <TaskRow key={task.recordId} task={task} onEdit={props.onEdit} onStatus={props.onStatus} />) : <EmptyState text="未来一周很从容" onAdd={() => props.onAdd()} />}</section>
    </div>
  </div>;
}

function TasksPage(props: PageProps) {
  const [filters, setFilters] = useState<TaskFilters>({ query: "", type: "all", status: "all" });
  const filtered = props.tasks.filter((task) => matchesTask(task, filters));
  const grouped = groupTasksByType(filtered);
  return <div className="page"><header className="page-header"><div><p className="eyebrow">TASKS</p><h1>全部任务</h1><p>集中管理每一件需要推进的事。</p></div><button className="primary" onClick={() => props.onAdd()}><Icon name="plus" />新增任务</button></header>
    <section className="panel filters"><input className="search" placeholder="搜索任务、描述或标签…" value={filters.query} onChange={(event) => setFilters({ ...filters, query: event.target.value })} /><select value={filters.type} onChange={(event) => setFilters({ ...filters, type: event.target.value as TaskFilters["type"] })}><option value="all">全部类型</option>{Object.entries(typeLabels).map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select><select value={filters.status} onChange={(event) => setFilters({ ...filters, status: event.target.value as TaskFilters["status"] })}><option value="all">全部状态</option>{Object.entries(statusLabels).map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select></section>
    <div className="grouped-tasks">{filtered.length ? (["ielts","competition","course","other"] as TaskType[]).map((type) => grouped[type].length > 0 && <section className="panel task-list" key={type}><div className="task-group-title"><i className={`type-dot type-${type}`}/><strong>{typeLabels[type]}</strong><span>{grouped[type].length} 项</span></div>{grouped[type].map((task) => <TaskRow key={task.recordId} task={task} onEdit={props.onEdit} onStatus={props.onStatus} />)}</section>) : <section className="panel"><EmptyState text="没有找到符合条件的任务" onAdd={() => props.onAdd()} /></section>}</div></div>;
}

function CalendarPage(props: PageProps) {
  const [cursor, setCursor] = useState(() => new Date());
  const cells = getMonthCells(cursor.getFullYear(), cursor.getMonth(), props.tasks);
  const monthLabel = new Intl.DateTimeFormat("zh-CN", { year: "numeric", month: "long" }).format(cursor);
  const shiftMonth = (offset: number) => setCursor(new Date(cursor.getFullYear(), cursor.getMonth() + offset, 1));
  return <div className="page"><header className="page-header"><div><p className="eyebrow">CALENDAR</p><h1>日历</h1><p>按时间查看任务，点击日期即可新增。</p></div><button className="primary" onClick={() => props.onAdd()}><Icon name="plus" />新增任务</button></header>
    <section className="panel calendar-panel"><div className="calendar-toolbar"><button className="round" onClick={() => shiftMonth(-1)}>‹</button><h2>{monthLabel}</h2><button className="round" onClick={() => shiftMonth(1)}>›</button><button className="ghost today-button" onClick={() => setCursor(new Date())}>回到今天</button></div><div className="weekdays">{["周一", "周二", "周三", "周四", "周五", "周六", "周日"].map((day) => <span key={day}>{day}</span>)}</div>
      <div className="calendar-grid">{cells.map((cell) => <div key={cell.dateKey} className={`calendar-cell ${cell.inMonth ? "" : "outside"} ${cell.dateKey === dateKey(new Date()) ? "today" : ""} ${hasCourseOnDate(cell.date, props.courses ?? []) ? "has-course" : ""}`}><button className="day-number" onClick={() => props.onAdd(`${cell.dateKey}T18:00`)}>{cell.date.getDate()}</button><div className="calendar-tasks">{cell.tasks.slice(0, 3).map((task) => <button key={task.recordId} className={`calendar-task type-bg-${task.taskType} ${task.status === "completed" ? "done" : ""}`} onClick={() => props.onEdit(task)} title={task.title}>{task.title}</button>)}{cell.tasks.length > 3 && <small>+{cell.tasks.length - 3} 项</small>}</div></div>)}</div>
    </section></div>;
}

function CoursePage({ courses, tasks, onOpenImport, onAddAssignment, onEditTask }: { courses: Course[]; tasks: Task[]; onOpenImport: () => void; onAddAssignment: (courseId: string) => void; onEditTask: (task: Task) => void }) {
  const weekdays = ["周一", "周二", "周三", "周四", "周五", "周六", "周日"];
  const [range, setRange] = useState<"week" | "all">("week");
  const courseTasks = tasks.filter((task) => task.courseId);
  const uniqueCourses = courses.filter((course, index) => courses.findIndex((item) => item.name === course.name) === index);
  return <div className="page"><header className="page-header"><div><p className="eyebrow">COURSES</p><h1>课程与课表</h1><p>先单独导入课表，再从具体课程创建作业。</p></div><button className="primary" onClick={onOpenImport}><Icon name="plus"/>导入课表</button></header><div className="range-switch"><button className={range === "week" ? "active" : ""} onClick={() => setRange("week")}>本周</button><button className={range === "all" ? "active" : ""} onClick={() => setRange("all")}>全部课程</button></div>
    {courses.length === 0 ? <section className="panel schedule-empty"><div className="schedule-illustration">课</div><h2>还没有导入课表</h2><p>上传 AI 按模板生成的 JSON 文件，或直接粘贴识别结果。</p><button className="primary" onClick={onOpenImport}>开始导入课表</button></section> : <>
      {range === "week" ? <section className="panel schedule-panel"><div className="schedule-head"><span>节次</span>{weekdays.map((day) => <strong key={day}>{day}</strong>)}</div><div className="week-grid">{Array.from({ length: 12 }, (_, index) => <div className="section-label" style={{ gridRow: index + 1 }} key={index}>{index + 1}</div>)}{weekdays.map((_, day) => Array.from({ length: 12 }, (__, row) => <div className="schedule-slot" style={{ gridColumn: day + 2, gridRow: row + 1 }} key={`${day}-${row}`}/>))}{courses.map((course) => <button key={course.recordId} className="course-card" style={{ gridColumn: course.weekday + 1, gridRow: `${course.startSection} / ${course.endSection + 1}`, backgroundColor: `${course.color}22`, borderLeftColor: course.color }} onClick={() => onAddAssignment(course.recordId)} title="点击新增这门课的任务"><strong>{course.name}</strong><span>{course.classroom || "教室未填"}</span><small>{course.startWeek}-{course.endWeek}周 · + 任务</small></button>)}</div></section> : <section className="all-courses">{uniqueCourses.map((course) => <button className="panel course-list-card" key={course.name} onClick={() => onAddAssignment(course.recordId)} style={{ borderTopColor: course.color }}><strong>{course.name}</strong><span>{course.teacher || "教师未填"}</span><small>{courses.filter((item) => item.name === course.name).length} 个上课时段 · 点击新增任务</small></button>)}</section>}
      <section className="panel course-assignments"><div className="panel-title"><div><span className="section-kicker">ASSIGNMENTS</span><h2>课程作业</h2></div></div>{courseTasks.length ? courseTasks.map((task) => { const course = courses.find((item) => item.recordId === task.courseId); return <button className="assignment-row" key={task.recordId} onClick={() => onEditTask(task)}><span className="course-chip" style={{ background: course?.color }}>{course?.name ?? "未知课程"}</span><strong>{task.title}</strong><span>{formatDateTime(task.dueAt)}</span></button>; }) : <p className="inline-empty">点击上方课表中的课程，即可为它添加作业。</p>}</section>
    </>}
  </div>;
}

function ImportScheduleDialog({ onClose, onImport }: { onClose: () => void; onImport: (content: string) => Promise<void> }) {
  const [content, setContent] = useState(""), [error, setError] = useState(""), [saving, setSaving] = useState(false), [copied, setCopied] = useState(false);
  const submit = async () => { try { parseScheduleImport(content); setSaving(true); await onImport(content); } catch (reason) { setError(reason instanceof Error ? reason.message : "导入失败"); } finally { setSaving(false); } };
  const chooseFile = async (file?: File) => { if (!file) return; try { setContent(await file.text()); setError(""); } catch { setError("无法读取这个文件"); } };
  return <div className="modal-backdrop"><div className="modal import-modal" role="dialog" aria-modal="true"><div className="modal-header"><div><span className="section-kicker">IMPORT SCHEDULE</span><h2>单独导入课表</h2></div><button className="close" onClick={onClose}>×</button></div><div className="import-steps"><span>1. 把课表图片或 PDF 发给 AI</span><span>2. 要求 AI 严格按模板返回 JSON</span><span>3. 在这里导入结果</span></div>
    <div className="template-box"><div><strong>AI 识别模板</strong><p>复制后连同课表文件一起发给 AI。</p></div><button className="ghost" onClick={async () => { await navigator.clipboard.writeText(scheduleTemplate); setCopied(true); }}>{copied ? "已复制" : "复制模板"}</button></div>
    <label className="file-drop">选择 AI 返回的 JSON 文件<input type="file" accept="application/json,.json" onChange={(event) => void chooseFile(event.target.files?.[0])}/></label><div className="or">或者直接粘贴 JSON</div><textarea className="json-input" rows={10} value={content} onChange={(event) => setContent(event.target.value)} placeholder={scheduleTemplate}/>{error && <p className="form-error">{error}</p>}<div className="modal-actions"><span className="spacer"/><button className="ghost" onClick={onClose}>取消</button><button className="primary" disabled={!content.trim() || saving} onClick={() => void submit()}>{saving ? "导入中…" : "确认导入"}</button></div></div></div>;
}

function TaskDialog({ task, courses, initialDueAt, initialCourseId, onClose, onSave, onDelete }: { task: Task | null; courses: Course[]; initialDueAt?: string; initialCourseId?: string; onClose: () => void; onSave: (input: TaskInput) => Promise<void>; onDelete: (task: Task) => Promise<void> }) {
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState<TaskInput>(() => task ? { title: task.title, taskType: task.taskType, description: task.description, tags: task.tags, priority: task.priority, startAt: task.startAt, dueAt: task.dueAt, reminderAt: task.reminderAt, notes: task.notes, courseId: task.courseId, courseTaskType: task.courseTaskType, customCourseTaskType: task.customCourseTaskType } : initialCourseId ? { ...createCourseTaskDraft(initialCourseId), dueAt: initialDueAt ?? null } : { title: "", taskType: "other", description: "", tags: [], priority: "medium", startAt: null, dueAt: initialDueAt ?? null, reminderAt: null, notes: "", courseId: null, courseTaskType: null, customCourseTaskType: null });
  const set = <K extends keyof TaskInput>(key: K, value: TaskInput[K]) => setForm((current) => ({ ...current, [key]: value }));
  const submit = async (event: React.FormEvent) => { event.preventDefault(); if (!form.title.trim()) return; setSaving(true); try { await onSave({ ...form, title: form.title.trim(), priority: form.taskType === "course" ? "medium" : form.priority, notes: form.taskType === "course" ? "" : form.notes }); } finally { setSaving(false); } };
  const isCourse = form.taskType === "course";
  return <div className="modal-backdrop" onMouseDown={(event) => event.target === event.currentTarget && onClose()}><div className="modal" role="dialog" aria-modal="true"><form onSubmit={submit}><div className="modal-header"><div><span className="section-kicker">{isCourse ? "COURSE TASK" : task ? "EDIT TASK" : "NEW TASK"}</span><h2>{isCourse ? (task ? "编辑课程任务" : "新增课程任务") : task ? "编辑任务" : "新增任务"}</h2></div><button type="button" className="close" onClick={onClose}>×</button></div>
    <label className="field full"><span>任务名称 *</span><input autoFocus maxLength={120} value={form.title} onChange={(event) => set("title", event.target.value)} placeholder={isCourse ? "例如：完成第三章习题" : "例如：准备竞赛报名材料"} /></label><div className="form-grid">{!isCourse && <><label className="field"><span>类型</span><select value={form.taskType} onChange={(event) => { const taskType = event.target.value as TaskType; setForm((current) => ({ ...current, taskType, courseId: taskType === "course" ? current.courseId : null, courseTaskType: taskType === "course" ? "assignment" : null })); }}>{Object.entries(typeLabels).map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select></label><label className="field"><span>优先级</span><select value={form.priority} onChange={(event) => set("priority", event.target.value as TaskPriority)}>{Object.entries(priorityLabels).map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select></label></>}
      {isCourse && <><label className="field"><span>课程 *</span><select value={form.courseId ?? ""} onChange={(event) => set("courseId", event.target.value || null)}><option value="">请选择已导入课程</option>{courses.map((course) => <option key={course.recordId} value={course.recordId}>{course.name} · 周{course.weekday} 第{course.startSection}-{course.endSection}节</option>)}</select></label><label className="field"><span>任务类型 *</span><select value={form.courseTaskType ?? "assignment"} onChange={(event) => set("courseTaskType", event.target.value as TaskInput["courseTaskType"])}>{Object.entries(courseTaskLabels).map(([value,label]) => <option value={value} key={value}>{label}</option>)}</select></label>{form.courseTaskType === "other" && <label className="field full"><span>新的类型名称（可选）</span><input maxLength={40} value={form.customCourseTaskType ?? ""} onChange={(event) => set("customCourseTaskType", event.target.value || null)} placeholder="例如：课堂展示"/></label>}</>}
      <label className="field"><span>开始时间</span><input type="datetime-local" value={form.startAt ?? ""} onChange={(event) => set("startAt", event.target.value || null)} /></label><label className="field"><span>截止时间</span><input type="datetime-local" value={form.dueAt ?? ""} onChange={(event) => set("dueAt", event.target.value || null)} /></label>{!isCourse && <label className="field full"><span>标签（用逗号分隔）</span><input value={form.tags.join(", ")} onChange={(event) => set("tags", event.target.value.split(/[,，]/).map((value) => value.trim()).filter(Boolean))} placeholder="每日练习, 重要" /></label>}<label className="field full"><span>{isCourse ? "任务描述 / 备注" : "任务描述"}</span><textarea rows={4} value={form.description} onChange={(event) => set("description", event.target.value)} placeholder="补充具体内容和完成标准" /></label>{!isCourse && <label className="field full"><span>备注</span><textarea rows={2} value={form.notes} onChange={(event) => set("notes", event.target.value)} /></label>}</div>
    <div className="modal-actions">{task && <button type="button" className="danger" onClick={() => onDelete(task)}>删除任务</button>}<span className="spacer"/><button type="button" className="ghost" onClick={onClose}>取消</button><button className="primary" disabled={saving || !form.title.trim() || (form.taskType === "course" && !form.courseId)}>{saving ? "保存中…" : "保存任务"}</button></div></form></div></div>;
}

function Shell() {
  const [tasks, setTasks] = useState<Task[]>([]), [courses, setCourses] = useState<Course[]>([]), [loading, setLoading] = useState(true), [error, setError] = useState("");
  const [dialog, setDialog] = useState<{ task: Task | null; dueAt?: string; courseId?: string } | null>(null);
  const [importOpen, setImportOpen] = useState(false);
  const load = useCallback(async () => { setLoading(true); setError(""); try { const [nextTasks, nextCourses] = await Promise.all([taskApi.list(), courseApi.list()]); setTasks(nextTasks); setCourses(nextCourses); } catch (reason) { setError(reason instanceof Error ? reason.message : "读取本地规划失败"); } finally { setLoading(false); } }, []);
  useEffect(() => { void load(); }, [load]);
  const add = (dueAt?: string) => setDialog({ task: null, dueAt });
  const save = async (input: TaskInput) => { try { if (dialog?.task) await taskApi.update(dialog.task.recordId, input); else await taskApi.create(input); setDialog(null); await load(); } catch (reason) { setError(reason instanceof Error ? reason.message : "保存失败"); } };
  const setStatus = async (task: Task, status: TaskStatus) => { try { const updated = await taskApi.setStatus(task.recordId, status); setTasks((items) => items.map((item) => item.recordId === updated.recordId ? updated : item)); } catch (reason) { setError(reason instanceof Error ? reason.message : "更新失败"); } };
  const remove = async (task: Task) => { if (!window.confirm(`确定删除“${task.title}”吗？记录会保留为可恢复的软删除状态。`)) return; try { await taskApi.remove(task.recordId); setDialog(null); await load(); } catch (reason) { setError(reason instanceof Error ? reason.message : "删除失败"); } };
  const importSchedule = async (content: string) => { const imported = await courseApi.import(parseScheduleImport(content)); setCourses(imported); setImportOpen(false); };
  const pageProps = { tasks, courses, onAdd: add, onEdit: (task: Task) => setDialog({ task }), onStatus: setStatus };
  return <div className="app-shell"><aside className="sidebar"><div className="brand"><div className="brand-mark">近</div><div><strong>近期规划</strong><small>Recent Plan</small></div></div><nav><NavLink to="/" end><Icon name="home"/><span>总览</span></NavLink><NavLink to="/tasks"><Icon name="tasks"/><span>全部任务</span></NavLink><NavLink to="/calendar"><Icon name="calendar"/><span>日历</span></NavLink><NavLink to="/courses"><Icon name="course"/><span>课程与课表</span></NavLink><NavLink to="/ielts"><span className="nav-letter">I</span><span>雅思</span></NavLink></nav><div className="sidebar-foot"><span className="local-dot"/>本地离线保存</div></aside><main className="content">{error && <div className="error-banner"><span>{error}</span><button onClick={() => setError("")}>×</button></div>}{loading ? <div className="loading"><span/>正在读取本地规划…</div> : <Routes><Route path="/" element={<Dashboard {...pageProps}/>} /><Route path="/tasks" element={<TasksPage {...pageProps}/>} /><Route path="/calendar" element={<CalendarPage {...pageProps}/>} /><Route path="/courses" element={<CoursePage courses={courses} tasks={tasks} onOpenImport={() => setImportOpen(true)} onAddAssignment={(courseId) => setDialog({ task: null, courseId })} onEditTask={(task) => setDialog({ task })}/>} /><Route path="/ielts/*" element={<IeltsPage/>}/></Routes>}</main>{dialog && <TaskDialog task={dialog.task} courses={courses} initialDueAt={dialog.dueAt} initialCourseId={dialog.courseId} onClose={() => setDialog(null)} onSave={save} onDelete={remove}/>} {importOpen && <ImportScheduleDialog onClose={() => setImportOpen(false)} onImport={importSchedule}/>}</div>;
}

export default function App() { return <BrowserRouter><Shell/></BrowserRouter>; }

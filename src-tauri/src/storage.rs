use chrono::{Datelike, Local, NaiveDate, SecondsFormat};
use serde::{Deserialize, Serialize};
use sha2::{Digest, Sha256};
use std::{
    fs::{self, File, OpenOptions},
    io::{self, Write},
    path::{Path, PathBuf},
};
use tauri::{AppHandle, Manager};
use uuid::Uuid;

const SCHEMA_VERSION: u32 = 1;

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct Task {
    pub schema_version: u32,
    pub record_id: String,
    pub entity_type: String,
    pub title: String,
    pub task_type: String,
    pub source_module: String,
    pub description: String,
    pub tags: Vec<String>,
    pub priority: String,
    pub status: String,
    pub start_at: Option<String>,
    pub due_at: Option<String>,
    pub reminder_at: Option<String>,
    pub created_at: String,
    pub updated_at: String,
    pub deleted_at: Option<String>,
    pub notes: String,
    #[serde(default)]
    pub course_id: Option<String>,
    #[serde(default)]
    pub course_task_type: Option<String>,
    #[serde(default)]
    pub custom_course_task_type: Option<String>,
    pub asset_refs: Vec<String>,
    pub source_import_id: Option<String>,
    pub content_hash: String,
}

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct CreateTaskInput {
    pub title: String,
    pub task_type: String,
    pub description: String,
    pub tags: Vec<String>,
    pub priority: String,
    pub start_at: Option<String>,
    pub due_at: Option<String>,
    pub reminder_at: Option<String>,
    pub notes: String,
    #[serde(default)]
    pub course_id: Option<String>,
    #[serde(default)]
    pub course_task_type: Option<String>,
    #[serde(default)]
    pub custom_course_task_type: Option<String>,
}

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct UpdateTaskInput {
    pub title: String,
    pub task_type: String,
    pub description: String,
    pub tags: Vec<String>,
    pub priority: String,
    pub start_at: Option<String>,
    pub due_at: Option<String>,
    pub reminder_at: Option<String>,
    pub notes: String,
    #[serde(default)]
    pub course_id: Option<String>,
    #[serde(default)]
    pub course_task_type: Option<String>,
    #[serde(default)]
    pub custom_course_task_type: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct Course {
    pub schema_version: u32,
    pub record_id: String,
    pub entity_type: String,
    pub name: String,
    pub teacher: String,
    pub classroom: String,
    pub weekday: u8,
    pub start_section: u8,
    pub end_section: u8,
    pub start_time: String,
    pub end_time: String,
    pub start_week: u8,
    pub end_week: u8,
    pub color: String,
    pub created_at: String,
    pub updated_at: String,
    pub deleted_at: Option<String>,
    pub content_hash: String,
    #[serde(default = "default_schedule_id")]
    pub schedule_id: String,
}

#[derive(Debug, Clone, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct CourseInput {
    pub name: String,
    #[serde(default)]
    pub teacher: String,
    #[serde(default)]
    pub classroom: String,
    pub weekday: u8,
    pub start_section: u8,
    pub end_section: u8,
    #[serde(default)]
    pub start_time: String,
    #[serde(default)]
    pub end_time: String,
    pub start_week: u8,
    pub end_week: u8,
    #[serde(default = "default_course_color")]
    pub color: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ScheduleSettings {
    pub semester_start_date: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct Schedule {
    pub id: String,
    pub name: String,
    pub semester_start_date: String,
    pub color: String,
    #[serde(default)]
    pub routines: Vec<ScheduleRoutine>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ScheduleRoutine { pub section: u8, pub start_time: String, pub end_time: String }

#[derive(Debug, Clone, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ScheduleUpdateInput { pub name: String, pub semester_start_date: String, pub color: String, #[serde(default)] pub routines: Vec<ScheduleRoutine> }

#[derive(Debug, Clone, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct CourseUpdateInput {
    pub name: String, #[serde(default)] pub teacher: String, #[serde(default)] pub classroom: String,
    pub weekday: u8, pub start_section: u8, pub end_section: u8,
    #[serde(default)] pub start_time: String, #[serde(default)] pub end_time: String,
    pub start_week: u8, pub end_week: u8, pub color: String,
    pub scope_weeks: Option<Vec<u8>>,
}

#[derive(Debug, Clone, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ScheduleImportInput {
    pub schedule_id: Option<String>,
    pub schedule_name: String,
    pub semester_start_date: String,
    pub color: String,
    pub mode: String,
    pub courses: Vec<CourseInput>,
}

fn default_course_color() -> String {
    "#6f8f7b".into()
}

fn default_schedule_id() -> String { "default".into() }

pub fn initialize(app: &AppHandle) -> io::Result<()> {
    synchronize(app)?;
    fs::create_dir_all(task_dir(app)?)?;
    fs::create_dir_all(data_dir(app)?.join("records").join("courses"))?;
    rebuild_index(app)?;
    rebuild_course_index(&data_dir(app)?)
}

/// Keeps the legacy Windows data location and the portable desktop data folder
/// identical.  When the same record exists in both places, the newer file wins.
pub fn synchronize(app: &AppHandle) -> io::Result<()> {
    let primary = data_dir(app)?;
    let legacy = app.path().app_data_dir()
        .map(|path| path.join("data"))
        .map_err(io::Error::other)?;
    if primary == legacy { return Ok(()); }
    sync_tree(&primary, &legacy)?;
    sync_tree(&legacy, &primary)
}

fn sync_tree(source: &Path, destination: &Path) -> io::Result<()> {
    if !source.exists() { return Ok(()); }
    for entry in fs::read_dir(source)? {
        let entry = entry?;
        let path = entry.path();
        let target = destination.join(entry.file_name());
        if path.is_dir() {
            sync_tree(&path, &target)?;
        } else if entry.file_name() != "INDEX.md" && entry.file_name() != "SCHEDULE.md" {
            let should_copy = !target.exists() || fs::metadata(&path)?.modified()? > fs::metadata(&target)?.modified()?;
            if should_copy {
                if let Some(parent) = target.parent() { fs::create_dir_all(parent)?; }
                fs::copy(path, target)?;
            }
        }
    }
    Ok(())
}

pub fn list_tasks(app: &AppHandle) -> io::Result<Vec<Task>> {
    list_tasks_from(&data_dir(app)?)
}

fn list_tasks_from(root: &Path) -> io::Result<Vec<Task>> {
    let directory = root.join("records").join("tasks");
    fs::create_dir_all(&directory)?;
    let mut tasks = Vec::new();
    for entry in fs::read_dir(directory)? {
        let path = entry?.path();
        if path.extension().and_then(|value| value.to_str()) != Some("md") {
            continue;
        }
        let Ok(content) = fs::read_to_string(&path) else {
            continue;
        };
        if let Ok(task) = parse_task(&content) {
            if task.deleted_at.is_none() {
                tasks.push(task);
            }
        }
    }
    tasks.sort_by(|a, b| b.updated_at.cmp(&a.updated_at));
    Ok(tasks)
}

pub fn create_task(app: &AppHandle, input: CreateTaskInput) -> io::Result<Task> {
    validate(&input.title, &input.task_type, &input.priority)?;
    validate_course_link(app, &input.task_type, input.course_id.as_deref())?;
    validate_course_task_type(&input.task_type, input.course_task_type.as_deref(), input.custom_course_task_type.as_deref())?;
    let now = now();
    let mut task = Task {
        schema_version: SCHEMA_VERSION,
        record_id: Uuid::new_v4().to_string(),
        entity_type: "task".into(),
        title: input.title.trim().to_string(),
        task_type: input.task_type,
        source_module: "task".into(),
        description: input.description.trim().to_string(),
        tags: normalize_tags(input.tags),
        priority: input.priority,
        status: "not_started".into(),
        start_at: normalize_optional(input.start_at),
        due_at: normalize_optional(input.due_at),
        reminder_at: normalize_optional(input.reminder_at),
        created_at: now.clone(),
        updated_at: now,
        deleted_at: None,
        notes: input.notes.trim().to_string(),
        course_id: normalize_optional(input.course_id),
        course_task_type: normalize_optional(input.course_task_type),
        custom_course_task_type: normalize_optional(input.custom_course_task_type),
        asset_refs: vec![],
        source_import_id: None,
        content_hash: String::new(),
    };
    save_task(app, &mut task)?;
    Ok(task)
}

pub fn update_task(app: &AppHandle, id: &str, input: UpdateTaskInput) -> io::Result<Task> {
    validate_id(id)?;
    validate(&input.title, &input.task_type, &input.priority)?;
    validate_course_link(app, &input.task_type, input.course_id.as_deref())?;
    validate_course_task_type(&input.task_type, input.course_task_type.as_deref(), input.custom_course_task_type.as_deref())?;
    let mut task = load_task(app, id)?;
    task.title = input.title.trim().to_string();
    task.task_type = input.task_type;
    task.description = input.description.trim().to_string();
    task.tags = normalize_tags(input.tags);
    task.priority = input.priority;
    task.start_at = normalize_optional(input.start_at);
    task.due_at = normalize_optional(input.due_at);
    task.reminder_at = normalize_optional(input.reminder_at);
    task.notes = input.notes.trim().to_string();
    task.course_id = normalize_optional(input.course_id);
    task.course_task_type = normalize_optional(input.course_task_type);
    task.custom_course_task_type = normalize_optional(input.custom_course_task_type);
    task.updated_at = now();
    save_task(app, &mut task)?;
    Ok(task)
}

pub fn set_task_status(app: &AppHandle, id: &str, status: &str) -> io::Result<Task> {
    validate_id(id)?;
    if !["not_started", "completed", "incomplete", "cancelled"].contains(&status) {
        return Err(invalid("不支持的任务状态"));
    }
    let mut task = load_task(app, id)?;
    task.status = status.to_string();
    task.updated_at = now();
    save_task(app, &mut task)?;
    Ok(task)
}

pub fn soft_delete_task(app: &AppHandle, id: &str) -> io::Result<()> {
    validate_id(id)?;
    let mut task = load_task(app, id)?;
    let timestamp = now();
    task.deleted_at = Some(timestamp.clone());
    task.updated_at = timestamp;
    save_task(app, &mut task).map(|_| ())
}

pub fn list_courses(app: &AppHandle) -> io::Result<Vec<Course>> {
    list_courses_from(&data_dir(app)?)
}

pub fn import_courses(app: &AppHandle, inputs: Vec<CourseInput>) -> io::Result<Vec<Course>> {
    import_courses_to_schedule(&data_dir(app)?, inputs, "default")
}

pub fn get_schedule_settings(app: &AppHandle) -> io::Result<ScheduleSettings> {
    get_schedule_settings_from(&data_dir(app)?)
}

pub fn save_schedule_settings(app: &AppHandle, semester_start_date: &str) -> io::Result<ScheduleSettings> {
    save_schedule_settings_to(&data_dir(app)?, semester_start_date)
}

pub fn list_schedules(app: &AppHandle) -> io::Result<Vec<Schedule>> {
    list_schedules_from(&data_dir(app)?)
}

pub fn import_schedule(app: &AppHandle, input: ScheduleImportInput) -> io::Result<Vec<Course>> {
    if input.schedule_name.trim().is_empty() || input.schedule_name.chars().count() > 60 {
        return Err(invalid("课表名称应为 1 到 60 个字符"));
    }
    if !["append", "replace"].contains(&input.mode.as_str()) {
        return Err(invalid("导入方式不正确"));
    }
    NaiveDate::parse_from_str(&input.semester_start_date, "%Y-%m-%d")
        .map_err(|_| invalid("请选择有效的开学日期"))?;
    if !input.color.starts_with('#') || input.color.len() != 7 { return Err(invalid("课表颜色必须使用 #RRGGBB 格式")); }
    if input.courses.is_empty() { return Err(invalid("课表中没有课程")); }
    for course in &input.courses { validate_course(course)?; }
    let root = data_dir(app)?;
    let mut schedules = list_schedules_from(&root)?;
    let id = input.schedule_id.filter(|id| !id.is_empty()).unwrap_or_else(|| Uuid::new_v4().to_string());
    if let Some(schedule) = schedules.iter_mut().find(|schedule| schedule.id == id) {
        schedule.name = input.schedule_name.trim().into();
        schedule.semester_start_date = input.semester_start_date.clone();
        schedule.color = input.color.clone();
    } else {
        schedules.push(Schedule { id: id.clone(), name: input.schedule_name.trim().into(), semester_start_date: input.semester_start_date.clone(), color: input.color.clone(), routines: vec![] });
    }
    if input.mode == "replace" {
        for mut course in list_courses_from(&root)?.into_iter().filter(|course| course.schedule_id == id) {
            course.deleted_at = Some(now()); course.updated_at = now(); save_course_to(&root, &mut course)?;
        }
    }
    import_courses_to_schedule(&root, input.courses, &id)?;
    save_schedules_to(&root, &schedules)?;
    list_courses_from(&root)
}

pub fn delete_schedule(app: &AppHandle, id: &str) -> io::Result<()> {
    let root = data_dir(app)?;
    let mut schedules = list_schedules_from(&root)?;
    if schedules.len() <= 1 { return Err(invalid("至少保留一份课表")); }
    let before = schedules.len(); schedules.retain(|schedule| schedule.id != id);
    if before == schedules.len() { return Err(invalid("课表不存在")); }
    for mut course in list_courses_from(&root)?.into_iter().filter(|course| course.schedule_id == id) {
        course.deleted_at = Some(now()); course.updated_at = now(); save_course_to(&root, &mut course)?;
    }
    save_schedules_to(&root, &schedules)
}

pub fn update_schedule(app: &AppHandle, id: &str, input: ScheduleUpdateInput) -> io::Result<Schedule> {
    if input.name.trim().is_empty() || input.name.chars().count() > 60 { return Err(invalid("课表名称应为 1 到 60 个字符")); }
    NaiveDate::parse_from_str(&input.semester_start_date, "%Y-%m-%d").map_err(|_| invalid("请选择有效的开学日期"))?;
    if !input.color.starts_with('#') || input.color.len() != 7 { return Err(invalid("课表颜色必须使用 #RRGGBB 格式")); }
    validate_routines(&input.routines)?;
    let root = data_dir(app)?;
    let mut schedules = list_schedules_from(&root)?;
    let schedule = schedules.iter_mut().find(|schedule| schedule.id == id).ok_or_else(|| invalid("课表不存在"))?;
    schedule.name = input.name.trim().into(); schedule.semester_start_date = input.semester_start_date; schedule.color = input.color; schedule.routines = input.routines;
    let result = schedule.clone(); save_schedules_to(&root, &schedules)?; Ok(result)
}

pub fn update_course(app: &AppHandle, id: &str, input: CourseUpdateInput) -> io::Result<Vec<Course>> {
    validate_id(id)?;
    let edited = CourseInput { name: input.name, teacher: input.teacher, classroom: input.classroom, weekday: input.weekday, start_section: input.start_section, end_section: input.end_section, start_time: input.start_time, end_time: input.end_time, start_week: input.start_week, end_week: input.end_week, color: input.color };
    validate_course(&edited)?;
    let root = data_dir(app)?; let source = list_courses_from(&root)?.into_iter().find(|course| course.record_id == id).ok_or_else(|| invalid("课程不存在"))?;
    let selected: Vec<u8> = input.scope_weeks.unwrap_or_default();
    if selected.is_empty() { return save_course_edit(&root, source, edited).map(|course| vec![course]); }
    if selected.iter().any(|week| *week < source.start_week || *week > source.end_week) { return Err(invalid("选择的周次不在原课程范围内")); }
    let mut selected = selected; selected.sort_unstable(); selected.dedup();
    if selected.len() == usize::from(source.end_week - source.start_week + 1) { return save_course_edit(&root, source, edited).map(|course| vec![course]); }
    let selected_set: std::collections::BTreeSet<u8> = selected.into_iter().collect();
    let mut groups: Vec<(bool, u8, u8)> = vec![];
    for week in source.start_week..=source.end_week { let changed = selected_set.contains(&week); match groups.last_mut() { Some((previous, _, end)) if *previous == changed => *end = week, _ => groups.push((changed, week, week)) } }
    let timestamp = now(); let mut first = true;
    for (changed, start_week, end_week) in groups { let base = if changed { &edited } else { &CourseInput { name: source.name.clone(), teacher: source.teacher.clone(), classroom: source.classroom.clone(), weekday: source.weekday, start_section: source.start_section, end_section: source.end_section, start_time: source.start_time.clone(), end_time: source.end_time.clone(), start_week, end_week, color: source.color.clone() } };
        let mut course = Course { schema_version: SCHEMA_VERSION, record_id: if first { first = false; source.record_id.clone() } else { Uuid::new_v4().to_string() }, entity_type: "course".into(), name: base.name.trim().into(), teacher: base.teacher.trim().into(), classroom: base.classroom.trim().into(), weekday: base.weekday, start_section: base.start_section, end_section: base.end_section, start_time: base.start_time.trim().into(), end_time: base.end_time.trim().into(), start_week, end_week, color: base.color.clone(), created_at: if first { timestamp.clone() } else { source.created_at.clone() }, updated_at: timestamp.clone(), deleted_at: None, content_hash: String::new(), schedule_id: source.schedule_id.clone() };
        save_course_to(&root, &mut course)?;
    }
    list_courses_from(&root)
}

fn save_course_edit(root: &Path, mut course: Course, input: CourseInput) -> io::Result<Course> {
    course.name = input.name.trim().into(); course.teacher = input.teacher.trim().into(); course.classroom = input.classroom.trim().into(); course.weekday = input.weekday; course.start_section = input.start_section; course.end_section = input.end_section; course.start_time = input.start_time.trim().into(); course.end_time = input.end_time.trim().into(); course.start_week = input.start_week; course.end_week = input.end_week; course.color = input.color; course.updated_at = now(); save_course_to(root, &mut course)?; Ok(course)
}

fn validate_routines(routines: &[ScheduleRoutine]) -> io::Result<()> {
    let mut previous = 0; for routine in routines { if routine.section == 0 || routine.section > 20 || routine.section <= previous || !valid_time(&routine.start_time) || !valid_time(&routine.end_time) || routine.start_time >= routine.end_time { return Err(invalid("作息的节次或时间不正确")); } previous = routine.section; } Ok(())
}
fn valid_time(value: &str) -> bool { value.len() == 5 && value.as_bytes().get(2) == Some(&b':') && NaiveDate::parse_from_str(&format!("2000-01-01 {value}"), "%Y-%m-%d %H:%M").is_ok() }

fn list_schedules_from(root: &Path) -> io::Result<Vec<Schedule>> {
    let path = root.join("SCHEDULES.md");
    if !path.exists() {
        let old = get_schedule_settings_from(root)?;
        let schedules = vec![Schedule { id: default_schedule_id(), name: "我的课表".into(), semester_start_date: old.semester_start_date, color: "#6f8f7b".into(), routines: vec![] }];
        save_schedules_to(root, &schedules)?;
        return Ok(schedules);
    }
    let content = fs::read_to_string(path)?;
    let json = content.split_once("```json\n").and_then(|(_, rest)| rest.split_once("\n```")).map(|(json, _)| json)
        .ok_or_else(|| invalid("课表列表文件格式错误"))?;
    serde_json::from_str(json).map_err(io::Error::other)
}

fn save_schedules_to(root: &Path, schedules: &[Schedule]) -> io::Result<()> {
    let json = serde_json::to_string_pretty(schedules).map_err(io::Error::other)?;
    atomic_write(&root.join("SCHEDULES.md"), format!("# 课表列表\n\n```json\n{json}\n```\n").as_bytes())
}

fn get_schedule_settings_from(root: &Path) -> io::Result<ScheduleSettings> {
    let path = root.join("SCHEDULE_SETTINGS.md");
    if !path.exists() {
        return Ok(ScheduleSettings { semester_start_date: format!("{}-09-01", Local::now().year()) });
    }
    let content = fs::read_to_string(path)?;
    let json = content.split_once("```json\n").and_then(|(_, rest)| rest.split_once("\n```")).map(|(json, _)| json)
        .ok_or_else(|| invalid("课表设置文件格式错误"))?;
    serde_json::from_str(json).map_err(io::Error::other)
}

fn save_schedule_settings_to(root: &Path, semester_start_date: &str) -> io::Result<ScheduleSettings> {
    NaiveDate::parse_from_str(semester_start_date, "%Y-%m-%d")
        .map_err(|_| invalid("请选择有效的开学日期"))?;
    let settings = ScheduleSettings { semester_start_date: semester_start_date.into() };
    let json = serde_json::to_string_pretty(&settings).map_err(io::Error::other)?;
    let body = format!("# 课表设置\n\n```json\n{json}\n```\n");
    fs::create_dir_all(root)?;
    atomic_write(&root.join("SCHEDULE_SETTINGS.md"), body.as_bytes())?;
    Ok(settings)
}

fn import_courses_to_schedule(root: &Path, inputs: Vec<CourseInput>, schedule_id: &str) -> io::Result<Vec<Course>> {
    if inputs.is_empty() {
        return Err(invalid("课表中没有课程"));
    }
    for input in &inputs {
        validate_course(input)?;
    }

    let existing = list_courses_from(root)?;
    for input in inputs {
        let matched = existing
            .iter()
            .find(|course| course.schedule_id == schedule_id && course_identity(course) == input_identity(&input));
        let timestamp = now();
        let mut course = Course {
            schema_version: SCHEMA_VERSION,
            record_id: matched
                .map(|course| course.record_id.clone())
                .unwrap_or_else(|| Uuid::new_v4().to_string()),
            entity_type: "course".into(),
            name: input.name.trim().into(),
            teacher: input.teacher.trim().into(),
            classroom: input.classroom.trim().into(),
            weekday: input.weekday,
            start_section: input.start_section,
            end_section: input.end_section,
            start_time: input.start_time.trim().into(),
            end_time: input.end_time.trim().into(),
            start_week: input.start_week,
            end_week: input.end_week,
            color: input.color,
            created_at: matched
                .map(|course| course.created_at.clone())
                .unwrap_or_else(|| timestamp.clone()),
            updated_at: timestamp,
            deleted_at: None,
            content_hash: String::new(),
            schedule_id: schedule_id.into(),
        };
        save_course_to(root, &mut course)?;
    }
    list_courses_from(root)
}

fn validate_course_link(
    app: &AppHandle,
    task_type: &str,
    course_id: Option<&str>,
) -> io::Result<()> {
    validate_course_link_at(&data_dir(app)?, task_type, course_id)
}

fn validate_course_link_at(
    root: &Path,
    task_type: &str,
    course_id: Option<&str>,
) -> io::Result<()> {
    if task_type != "course" {
        return Ok(());
    }
    let id = course_id
        .filter(|id| !id.trim().is_empty())
        .ok_or_else(|| invalid("课程作业必须选择一门已导入课程"))?;
    validate_id(id)?;
    if !list_courses_from(root)?
        .iter()
        .any(|course| course.record_id == id)
    {
        return Err(invalid("关联课程不存在，请重新选择"));
    }
    Ok(())
}

fn validate_course_task_type(task_type: &str, value: Option<&str>, custom: Option<&str>) -> io::Result<()> {
    if task_type != "course" { return Ok(()); }
    let value = value.ok_or_else(|| invalid("请选择课程任务类型"))?;
    if !["assignment", "test", "exam", "report", "other"].contains(&value) {
        return Err(invalid("课程任务类型不正确"));
    }
    if value == "other" && custom.map(str::trim).unwrap_or("").chars().count() > 40 {
        return Err(invalid("自定义任务类型不能超过 40 个字符"));
    }
    Ok(())
}

fn validate_course(input: &CourseInput) -> io::Result<()> {
    if input.name.trim().is_empty() || input.name.chars().count() > 120 {
        return Err(invalid("课程名称应为 1 到 120 个字符"));
    }
    if !(1..=7).contains(&input.weekday)
        || input.start_section == 0
        || input.end_section < input.start_section
        || input.end_section > 20
        || input.start_week == 0
        || input.end_week < input.start_week
        || input.end_week > 60
    {
        return Err(invalid("课程的星期、节次或周次范围不正确"));
    }
    if !input.color.starts_with('#') || input.color.len() != 7 {
        return Err(invalid("课程颜色必须使用 #RRGGBB 格式"));
    }
    Ok(())
}

fn course_identity(course: &Course) -> String {
    format!(
        "{}|{}|{}|{}|{}|{}",
        course.name.to_lowercase(),
        course.weekday,
        course.start_section,
        course.end_section,
        course.start_week,
        course.end_week
    )
}

fn input_identity(course: &CourseInput) -> String {
    format!(
        "{}|{}|{}|{}|{}|{}",
        course.name.trim().to_lowercase(),
        course.weekday,
        course.start_section,
        course.end_section,
        course.start_week,
        course.end_week
    )
}

fn save_task(app: &AppHandle, task: &mut Task) -> io::Result<()> {
    save_task_to(&data_dir(app)?, task)
}

fn save_task_to(root: &Path, task: &mut Task) -> io::Result<()> {
    task.content_hash = calculate_hash(task);
    validate_id(&task.record_id)?;
    let path = root.join("records").join("tasks").join(format!("{}.md", task.record_id));
    atomic_write(&path, render_task(task).as_bytes())?;
    rebuild_index_at(root)
}

fn list_courses_from(root: &Path) -> io::Result<Vec<Course>> {
    let directory = root.join("records").join("courses");
    fs::create_dir_all(&directory)?;
    let mut courses = Vec::new();
    for entry in fs::read_dir(directory)? {
        let path = entry?.path();
        if path.extension().and_then(|value| value.to_str()) != Some("md") {
            continue;
        }
        let Ok(content) = fs::read_to_string(&path) else {
            continue;
        };
        if let Ok(course) = parse_course(&content) {
            if course.deleted_at.is_none() {
                courses.push(course);
            }
        }
    }
    courses.sort_by_key(|course| (course.weekday, course.start_section));
    Ok(courses)
}

fn save_course_to(root: &Path, course: &mut Course) -> io::Result<()> {
    let mut copy = course.clone();
    copy.content_hash.clear();
    let bytes = serde_json::to_vec(&copy).unwrap_or_default();
    course.content_hash = Sha256::digest(bytes)
        .iter()
        .map(|byte| format!("{byte:02x}"))
        .collect();
    validate_id(&course.record_id)?;
    let path = root
        .join("records")
        .join("courses")
        .join(format!("{}.md", course.record_id));
    atomic_write(&path, render_course(course).as_bytes())?;
    rebuild_course_index(root)
}

fn load_task(app: &AppHandle, id: &str) -> io::Result<Task> {
    let path = task_path(app, id)?;
    if !path.exists() {
        return Err(io::Error::new(io::ErrorKind::NotFound, "任务不存在"));
    }
    parse_task(&fs::read_to_string(path)?)
}

pub(crate) fn data_dir(app: &AppHandle) -> io::Result<PathBuf> {
    // 发布版把数据固定放在 exe 同级目录，避免不同启动方式解析到不同的
    // Windows 用户数据目录。开发环境仍沿用 Tauri 默认目录，避免污染发布包。
    if let Ok(exe_path) = std::env::current_exe() {
        if let Some(exe_dir) = exe_path.parent() {
            if exe_dir.file_name().is_some_and(|name| name == "桌面版") {
                return Ok(exe_dir.join("近期规划数据"));
            }
        }
    }
    app.path()
        .app_data_dir()
        .map(|path| path.join("data"))
        .map_err(|error| io::Error::new(io::ErrorKind::Other, error))
}

fn task_dir(app: &AppHandle) -> io::Result<PathBuf> {
    Ok(data_dir(app)?.join("records").join("tasks"))
}

fn task_path(app: &AppHandle, id: &str) -> io::Result<PathBuf> {
    validate_id(id)?;
    Ok(task_dir(app)?.join(format!("{id}.md")))
}

fn validate_id(id: &str) -> io::Result<()> {
    Uuid::parse_str(id)
        .map(|_| ())
        .map_err(|_| invalid("任务 id 非法"))
}

fn validate(title: &str, task_type: &str, priority: &str) -> io::Result<()> {
    if title.trim().is_empty() || title.chars().count() > 120 || title.contains(['\r', '\n']) {
        return Err(invalid("任务名称应为 1 到 120 个字符"));
    }
    if !["ielts", "competition", "course", "other"].contains(&task_type) {
        return Err(invalid("不支持的任务类型"));
    }
    if !["low", "medium", "high", "urgent"].contains(&priority) {
        return Err(invalid("不支持的优先级"));
    }
    Ok(())
}

fn invalid(message: &str) -> io::Error {
    io::Error::new(io::ErrorKind::InvalidInput, message)
}

fn now() -> String {
    Local::now().to_rfc3339_opts(SecondsFormat::Secs, true)
}

fn normalize_optional(value: Option<String>) -> Option<String> {
    value.and_then(|value| {
        let value = value.trim().to_string();
        (!value.is_empty()).then_some(value)
    })
}

fn normalize_tags(tags: Vec<String>) -> Vec<String> {
    let mut output = Vec::new();
    for tag in tags {
        let tag = tag.trim().to_string();
        if !tag.is_empty() && !output.contains(&tag) {
            output.push(tag);
        }
    }
    output
}

fn json<T: Serialize>(value: &T) -> String {
    serde_json::to_string(value).unwrap_or_else(|_| "null".into())
}

fn render_task(task: &Task) -> String {
    format!(
        "---\nschema_version: {}\nrecord_id: {}\nentity_type: {}\ntitle: {}\nstatus: {}\ncreated_at: {}\nupdated_at: {}\ndeleted_at: {}\ntags: {}\nasset_refs: {}\nsource_import_id: {}\ncontent_hash: {}\ntask_type: {}\nsource_module: {}\ncourse_id: {}\ncourse_task_type: {}\ncustom_course_task_type: {}\npriority: {}\nstart_at: {}\ndue_at: {}\nreminder_at: {}\ndescription: {}\nnotes: {}\n---\n\n# {}\n\n## 基本信息\n\n{}\n\n## 备注\n\n{}\n",
        task.schema_version,
        json(&task.record_id), json(&task.entity_type), json(&task.title), json(&task.status),
        json(&task.created_at), json(&task.updated_at), json(&task.deleted_at), json(&task.tags),
        json(&task.asset_refs), json(&task.source_import_id), json(&task.content_hash), json(&task.task_type),
        json(&task.source_module), json(&task.course_id), json(&task.course_task_type), json(&task.custom_course_task_type), json(&task.priority), json(&task.start_at), json(&task.due_at),
        json(&task.reminder_at), json(&task.description), json(&task.notes), task.title,
        if task.description.is_empty() { "暂无描述" } else { &task.description },
        if task.notes.is_empty() { "暂无备注" } else { &task.notes },
    )
}

fn parse_task(content: &str) -> io::Result<Task> {
    let front_matter = content
        .strip_prefix("---\n")
        .and_then(|value| value.split_once("\n---"))
        .map(|(front_matter, _)| front_matter)
        .ok_or_else(|| invalid("Markdown front matter 格式错误"))?;
    let mut map = serde_json::Map::new();
    for line in front_matter.lines() {
        let (key, value) = line
            .split_once(':')
            .ok_or_else(|| invalid("Markdown 字段格式错误"))?;
        let parsed = serde_json::from_str(value.trim())
            .map_err(|error| invalid(&format!("字段 {key} 无法解析: {error}")))?;
        let key = match key.trim() {
            "schema_version" => "schemaVersion",
            "record_id" => "recordId",
            "entity_type" => "entityType",
            "created_at" => "createdAt",
            "updated_at" => "updatedAt",
            "deleted_at" => "deletedAt",
            "asset_refs" => "assetRefs",
            "source_import_id" => "sourceImportId",
            "content_hash" => "contentHash",
            "task_type" => "taskType",
            "source_module" => "sourceModule",
            "course_id" => "courseId",
            "course_task_type" => "courseTaskType",
            "custom_course_task_type" => "customCourseTaskType",
            "start_at" => "startAt",
            "due_at" => "dueAt",
            "reminder_at" => "reminderAt",
            other => other,
        };
        map.insert(key.to_string(), parsed);
    }
    serde_json::from_value(serde_json::Value::Object(map))
        .map_err(|error| invalid(&format!("任务记录字段不完整: {error}")))
}

fn render_course(course: &Course) -> String {
    format!(
        "---\nschema_version: {}\nrecord_id: {}\nentity_type: {}\nname: {}\nteacher: {}\nclassroom: {}\nweekday: {}\nstart_section: {}\nend_section: {}\nstart_time: {}\nend_time: {}\nstart_week: {}\nend_week: {}\ncolor: {}\nschedule_id: {}\ncreated_at: {}\nupdated_at: {}\ndeleted_at: {}\ncontent_hash: {}\n---\n\n# {}\n\n- 教师：{}\n- 教室：{}\n- 上课：周{}，第 {}-{} 节\n- 周次：第 {}-{} 周\n",
        course.schema_version, json(&course.record_id), json(&course.entity_type), json(&course.name),
        json(&course.teacher), json(&course.classroom), course.weekday, course.start_section,
        course.end_section, json(&course.start_time), json(&course.end_time), course.start_week,
        course.end_week, json(&course.color), json(&course.schedule_id), json(&course.created_at), json(&course.updated_at),
        json(&course.deleted_at), json(&course.content_hash), course.name,
        if course.teacher.is_empty() { "未填写" } else { &course.teacher },
        if course.classroom.is_empty() { "未填写" } else { &course.classroom },
        course.weekday, course.start_section, course.end_section, course.start_week, course.end_week
    )
}

fn parse_course(content: &str) -> io::Result<Course> {
    let front_matter = content
        .strip_prefix("---\n")
        .and_then(|value| value.split_once("\n---"))
        .map(|(front_matter, _)| front_matter)
        .ok_or_else(|| invalid("课程 Markdown front matter 格式错误"))?;
    let mut map = serde_json::Map::new();
    for line in front_matter.lines() {
        let (key, value) = line.split_once(':').ok_or_else(|| invalid("课程字段格式错误"))?;
        let parsed = serde_json::from_str(value.trim())
            .map_err(|error| invalid(&format!("字段 {key} 无法解析: {error}")))?;
        let key = match key.trim() {
            "schema_version" => "schemaVersion", "record_id" => "recordId",
            "entity_type" => "entityType", "start_section" => "startSection",
            "end_section" => "endSection", "start_time" => "startTime",
            "end_time" => "endTime", "start_week" => "startWeek", "end_week" => "endWeek", "schedule_id" => "scheduleId",
            "created_at" => "createdAt", "updated_at" => "updatedAt",
            "deleted_at" => "deletedAt", "content_hash" => "contentHash", other => other,
        };
        map.insert(key.to_string(), parsed);
    }
    serde_json::from_value(serde_json::Value::Object(map))
        .map_err(|error| invalid(&format!("课程记录字段不完整: {error}")))
}

fn rebuild_course_index(root: &Path) -> io::Result<()> {
    let courses = list_courses_from(root)?;
    let mut output = String::from("# 周课表索引\n\n> 此文件由应用自动生成。\n\n| 星期 | 节次 | 周次 | 课程 | 教室 | 记录 ID |\n|---|---|---|---|---|---|\n");
    for course in courses {
        output.push_str(&format!("| 周{} | {}-{} | {}-{} | {} | {} | `{}` |\n",
            course.weekday, course.start_section, course.end_section, course.start_week,
            course.end_week, course.name.replace('|', "\\|"), course.classroom.replace('|', "\\|"), course.record_id));
    }
    atomic_write(&root.join("SCHEDULE.md"), output.as_bytes())
}

fn calculate_hash(task: &Task) -> String {
    let mut copy = task.clone();
    copy.content_hash.clear();
    let bytes = serde_json::to_vec(&copy).unwrap_or_default();
    Sha256::digest(bytes).iter().map(|byte| format!("{byte:02x}")).collect()
}

fn rebuild_index(app: &AppHandle) -> io::Result<()> {
    rebuild_index_at(&data_dir(app)?)
}

fn rebuild_index_at(root: &Path) -> io::Result<()> {
    let tasks = list_tasks_from(root)?;
    let mut output = String::from("# 近期规划索引\n\n> 此文件由应用自动生成，可安全删除并重建。\n\n| 截止时间 | 状态 | 优先级 | 类型 | 任务 | 记录 ID |\n|---|---|---|---|---|---|\n");
    for task in tasks {
        output.push_str(&format!(
            "| {} | {} | {} | {} | {} | `{}` |\n",
            task.due_at.as_deref().unwrap_or("—"), task.status, task.priority,
            task.task_type, task.title.replace('|', "\\|"), task.record_id
        ));
    }
    atomic_write(&root.join("INDEX.md"), output.as_bytes())
}

fn atomic_write(path: &Path, bytes: &[u8]) -> io::Result<()> {
    let parent = path.parent().ok_or_else(|| invalid("目标路径无父目录"))?;
    fs::create_dir_all(parent)?;
    let temp = parent.join(format!(".{}.{}.tmp", path.file_name().unwrap().to_string_lossy(), Uuid::new_v4()));
    let backup = parent.join(format!(".{}.bak", path.file_name().unwrap().to_string_lossy()));
    let mut file: File = OpenOptions::new().write(true).create_new(true).open(&temp)?;
    file.write_all(bytes)?;
    file.sync_all()?;
    drop(file);

    if path.exists() {
        if backup.exists() { fs::remove_file(&backup)?; }
        fs::rename(path, &backup)?;
    }
    if let Err(error) = fs::rename(&temp, path) {
        if backup.exists() { let _ = fs::rename(&backup, path); }
        let _ = fs::remove_file(&temp);
        return Err(error);
    }
    if backup.exists() { fs::remove_file(backup)?; }
    Ok(())
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn markdown_round_trip_preserves_task() {
        let mut task = Task {
            schema_version: 1, record_id: Uuid::new_v4().to_string(), entity_type: "task".into(),
            title: "完成阅读练习".into(), task_type: "ielts".into(), source_module: "task".into(),
            description: "Cambridge 18 Test 1".into(), tags: vec!["阅读".into()], priority: "high".into(),
            status: "not_started".into(), start_at: None, due_at: Some("2026-09-12T20:00".into()),
            reminder_at: None, created_at: now(), updated_at: now(), deleted_at: None,
            notes: "控制在 60 分钟".into(), course_id: None, course_task_type: None, custom_course_task_type: None, asset_refs: vec![], source_import_id: None, content_hash: String::new(),
        };
        task.content_hash = calculate_hash(&task);
        let parsed = parse_task(&render_task(&task)).unwrap();
        assert_eq!(parsed.record_id, task.record_id);
        assert_eq!(parsed.title, task.title);
        assert_eq!(parsed.tags, task.tags);
        assert_eq!(parsed.content_hash, task.content_hash);
    }

    #[test]
    fn content_hash_changes_with_content() {
        let mut task = Task {
            schema_version: 1, record_id: Uuid::new_v4().to_string(), entity_type: "task".into(),
            title: "任务 A".into(), task_type: "other".into(), source_module: "task".into(),
            description: String::new(), tags: vec![], priority: "medium".into(), status: "not_started".into(),
            start_at: None, due_at: None, reminder_at: None, created_at: now(), updated_at: now(),
            deleted_at: None, notes: String::new(), course_id: None, course_task_type: None, custom_course_task_type: None, asset_refs: vec![], source_import_id: None,
            content_hash: String::new(),
        };
        let first = calculate_hash(&task);
        assert_eq!(first, calculate_hash(&task));
        task.title = "任务 B".into();
        assert_ne!(first, calculate_hash(&task));
    }

    #[test]
    fn rejects_invalid_task_fields() {
        assert!(validate("", "other", "medium").is_err());
        assert!(validate("标题", "unknown", "medium").is_err());
        assert!(validate("标题", "other", "immediate").is_err());
        assert!(validate("破坏\n索引", "other", "medium").is_err());
        assert!(validate_id("../escape").is_err());
    }

    #[test]
    fn storage_lifecycle_rebuilds_index_and_keeps_soft_deleted_file() {
        let root = std::env::temp_dir().join(format!("recent-plan-test-{}", Uuid::new_v4()));
        fs::create_dir_all(&root).unwrap();
        let mut task = Task {
            schema_version: 1, record_id: Uuid::new_v4().to_string(), entity_type: "task".into(),
            title: "持久化任务".into(), task_type: "course".into(), source_module: "task".into(),
            description: "重启后仍应存在".into(), tags: vec!["验收".into()], priority: "high".into(),
            status: "not_started".into(), start_at: None, due_at: Some("2026-09-12T18:00".into()),
            reminder_at: None, created_at: now(), updated_at: now(), deleted_at: None,
            notes: String::new(), course_id: None, course_task_type: None, custom_course_task_type: None, asset_refs: vec![], source_import_id: None, content_hash: String::new(),
        };

        save_task_to(&root, &mut task).unwrap();
        let reloaded = list_tasks_from(&root).unwrap();
        assert_eq!(reloaded.len(), 1);
        assert_eq!(reloaded[0].title, "持久化任务");
        assert!(fs::read_to_string(root.join("INDEX.md")).unwrap().contains("持久化任务"));

        task.deleted_at = Some(now());
        save_task_to(&root, &mut task).unwrap();
        assert!(list_tasks_from(&root).unwrap().is_empty());
        assert!(root.join("records").join("tasks").join(format!("{}.md", task.record_id)).exists());
        assert!(!fs::read_to_string(root.join("INDEX.md")).unwrap().contains("持久化任务"));
        fs::remove_dir_all(root).unwrap();
    }

    #[test]
    fn malformed_record_does_not_hide_other_tasks_or_courses() {
        let root = std::env::temp_dir().join(format!("recent-plan-partial-read-{}", Uuid::new_v4()));
        fs::create_dir_all(root.join("records").join("tasks")).unwrap();
        fs::create_dir_all(root.join("records").join("courses")).unwrap();

        let mut task = Task {
            schema_version: 1, record_id: Uuid::new_v4().to_string(), entity_type: "task".into(),
            title: "可读取任务".into(), task_type: "other".into(), source_module: "task".into(),
            description: String::new(), tags: vec![], priority: "medium".into(), status: "not_started".into(),
            start_at: None, due_at: None, reminder_at: None, created_at: now(), updated_at: now(),
            deleted_at: None, notes: String::new(), course_id: None, course_task_type: None,
            custom_course_task_type: None, asset_refs: vec![], source_import_id: None, content_hash: String::new(),
        };
        save_task_to(&root, &mut task).unwrap();
        fs::write(root.join("records").join("tasks").join("broken.md"), "broken task").unwrap();

        let input = CourseInput {
            name: "可读取课程".into(), teacher: String::new(), classroom: String::new(),
            weekday: 1, start_section: 1, end_section: 2, start_time: String::new(), end_time: String::new(),
            start_week: 1, end_week: 16, color: "#6f8f7b".into(),
        };
        import_courses_to_schedule(&root, vec![input], "default").unwrap();
        fs::write(root.join("records").join("courses").join("broken.md"), "broken course").unwrap();

        assert_eq!(list_tasks_from(&root).unwrap().len(), 1);
        assert_eq!(list_courses_from(&root).unwrap().len(), 1);
        fs::remove_dir_all(root).unwrap();
    }

    #[test]
    fn course_import_round_trips_and_merges_repeat_import() {
        let root = std::env::temp_dir().join(format!("recent-plan-course-test-{}", Uuid::new_v4()));
        fs::create_dir_all(&root).unwrap();
        let input = CourseInput {
            name: "高等数学".into(), teacher: "张老师".into(), classroom: "A101".into(),
            weekday: 1, start_section: 1, end_section: 2, start_time: "08:00".into(),
            end_time: "09:40".into(), start_week: 1, end_week: 16, color: "#6f8f7b".into(),
        };
        let first = import_courses_to_schedule(&root, vec![input.clone()], "default").unwrap();
        let record_id = first[0].record_id.clone();
        let mut changed = input;
        changed.classroom = "A102".into();
        let second = import_courses_to_schedule(&root, vec![changed], "default").unwrap();

        assert_eq!(second.len(), 1);
        assert_eq!(second[0].record_id, record_id);
        assert_eq!(second[0].classroom, "A102");
        assert!(validate_course_link_at(&root, "course", Some(&record_id)).is_ok());
        assert!(validate_course_link_at(&root, "course", None).is_err());
        assert!(validate_course_link_at(&root, "course", Some(&Uuid::new_v4().to_string())).is_err());
        assert!(fs::read_to_string(root.join("SCHEDULE.md")).unwrap().contains("高等数学"));
        fs::remove_dir_all(root).unwrap();
    }

    #[test]
    fn schedule_settings_default_and_round_trip_accept_any_valid_start_date() {
        let root = std::env::temp_dir().join(format!("recent-plan-settings-test-{}", Uuid::new_v4()));
        fs::create_dir_all(&root).unwrap();
        assert!(get_schedule_settings_from(&root).unwrap().semester_start_date.ends_with("-09-01"));
        assert!(save_schedule_settings_to(&root, "2026-09-31").is_err());
        save_schedule_settings_to(&root, "2026-09-01").unwrap();
        assert_eq!(get_schedule_settings_from(&root).unwrap().semester_start_date, "2026-09-01");
        fs::remove_dir_all(root).unwrap();
    }

    #[test]
    fn schedule_routines_reject_invalid_sections_and_times() {
        assert!(validate_routines(&[ScheduleRoutine { section: 1, start_time: "08:00".into(), end_time: "08:45".into() }]).is_ok());
        assert!(validate_routines(&[ScheduleRoutine { section: 1, start_time: "09:00".into(), end_time: "08:45".into() }]).is_err());
        assert!(validate_routines(&[ScheduleRoutine { section: 1, start_time: "08:00".into(), end_time: "08:45".into() }, ScheduleRoutine { section: 1, start_time: "09:00".into(), end_time: "09:45".into() }]).is_err());
    }
}

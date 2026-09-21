use chrono::{Local, SecondsFormat};
use serde::{de::DeserializeOwned, Deserialize, Serialize};
use std::{fs, io, path::{Path, PathBuf}};
use tauri::AppHandle;
use uuid::Uuid;

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct IeltsScores { pub reading: f32, pub listening: f32, pub writing: f32, pub speaking: f32 }

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct IeltsGoal { pub reading: f32, pub listening: f32, pub writing: f32, pub speaking: f32, pub updated_at: String }

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct IeltsWork {
    pub record_id: String, pub name: String, pub category: String, pub due_at: Option<String>,
    pub expected_minutes: Option<u16>, pub completed_at: Option<String>, pub actual_minutes: Option<u16>,
    pub score: Option<f32>, pub reading_correct: Option<Vec<u8>>, #[serde(default)] pub reading_totals: Option<Vec<u8>>, pub listening_correct: Option<Vec<u8>>, #[serde(default)] pub listening_totals: Option<Vec<u8>>,
    #[serde(default)] pub deleted_at: Option<String>, pub created_at: String, pub updated_at: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct IeltsMock { pub record_id: String, pub exam_at: String, pub reading: f32, pub listening: f32, pub writing: f32, pub speaking: f32, pub notes: String, pub created_at: String, pub updated_at: String }

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct IeltsCourse { pub record_id: String, pub name: String, pub start_at: String, pub end_at: String, pub teacher: String, #[serde(default)] pub classroom: String, #[serde(default = "default_ielts_course_color")] pub color: String, pub notes: String, pub created_at: String, pub updated_at: String }

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct IeltsData { pub goal: Option<IeltsGoal>, pub works: Vec<IeltsWork>, pub mocks: Vec<IeltsMock>, pub courses: Vec<IeltsCourse>, pub read_warnings: Vec<String> }

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct WorkInput { pub name: String, pub category: String, pub due_at: Option<String>, pub expected_minutes: Option<u16> }

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct CompleteInput { pub actual_minutes: u16, pub score: Option<f32>, pub reading_correct: Option<Vec<u8>>, #[serde(default)] pub reading_totals: Option<Vec<u8>>, pub listening_correct: Option<Vec<u8>>, #[serde(default)] pub listening_totals: Option<Vec<u8>> }

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct MockInput { pub exam_at: String, pub reading: f32, pub listening: f32, pub writing: f32, pub speaking: f32, #[serde(default)] pub notes: String }

#[derive(Debug, Clone, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct IeltsCourseInput { pub name: String, pub start_at: String, pub end_at: String, #[serde(default)] pub teacher: String, #[serde(default)] pub classroom: String, #[serde(default = "default_ielts_course_color")] pub color: String, #[serde(default)] pub notes: String }

fn default_ielts_course_color() -> String { "#6f8f7b".into() }

pub fn get(app: &AppHandle) -> io::Result<IeltsData> {
    let root = root(app)?;
    fs::create_dir_all(root.join("works"))?;
    fs::create_dir_all(root.join("mocks"))?;
    fs::create_dir_all(root.join("courses"))?;
    let mut read_warnings = Vec::new();
    let goal = match read_optional(&root.join("goal.md")) {
        Ok(goal) => goal,
        Err(error) => { read_warnings.push(format!("雅思目标读取失败: {error}")); None }
    };
    let mut works = read_directory(&root.join("works"), &mut read_warnings)?;
    let mut mocks = read_directory(&root.join("mocks"), &mut read_warnings)?;
    let mut courses = read_directory(&root.join("courses"), &mut read_warnings)?;
    works.sort_by(|a: &IeltsWork, b| b.updated_at.cmp(&a.updated_at));
    mocks.sort_by(|a: &IeltsMock, b| b.exam_at.cmp(&a.exam_at));
    courses.sort_by(|a: &IeltsCourse, b| a.start_at.cmp(&b.start_at));
    Ok(IeltsData { goal, works, mocks, courses, read_warnings })
}

pub fn save_goal(app: &AppHandle, scores: IeltsScores) -> io::Result<IeltsGoal> {
    validate_scores(&scores)?;
    let goal = IeltsGoal { reading: scores.reading, listening: scores.listening, writing: scores.writing, speaking: scores.speaking, updated_at: now() };
    write_record(&root(app)?.join("goal.md"), "ielts_goal", "雅思目标", &goal)?;
    Ok(goal)
}

pub fn create_work(app: &AppHandle, input: WorkInput) -> io::Result<IeltsWork> {
    if input.name.trim().is_empty() { return Err(invalid("作业名称不能为空")); }
    validate_category(&input.category)?;
    let timestamp = now();
    let work = IeltsWork { record_id: Uuid::new_v4().to_string(), name: input.name.trim().into(), category: input.category,
        due_at: normalize(input.due_at), expected_minutes: input.expected_minutes, completed_at: None, actual_minutes: None,
        score: None, reading_correct: None, reading_totals: None, listening_correct: None, listening_totals: None, deleted_at: None, created_at: timestamp.clone(), updated_at: timestamp };
    write_work(app, &work)?;
    Ok(work)
}

pub fn complete_work(app: &AppHandle, id: &str, input: CompleteInput) -> io::Result<IeltsWork> {
    Uuid::parse_str(id).map_err(|_| invalid("作业 id 不正确"))?;
    let path = root(app)?.join("works").join(format!("{id}.md"));
    let mut work: IeltsWork = read_optional(&path)?.ok_or_else(|| io::Error::new(io::ErrorKind::NotFound, "作业不存在"))?;
    validate_completion(&work.category, &input)?;
    let calculated_score = completion_score(&work.category, &input);
    work.actual_minutes = Some(input.actual_minutes); work.score = calculated_score;
    work.reading_correct = input.reading_correct; work.reading_totals = input.reading_totals; work.listening_correct = input.listening_correct; work.listening_totals = input.listening_totals;
    let timestamp = now(); work.completed_at = Some(timestamp.clone()); work.updated_at = timestamp;
    write_work(app, &work)?;
    Ok(work)
}

pub fn update_work_result(app: &AppHandle, id: &str, input: CompleteInput) -> io::Result<IeltsWork> {
    Uuid::parse_str(id).map_err(|_| invalid("作业 id 不正确"))?;
    let path = root(app)?.join("works").join(format!("{id}.md"));
    let mut work: IeltsWork = read_optional(&path)?.ok_or_else(|| io::Error::new(io::ErrorKind::NotFound, "作业不存在"))?;
    if work.completed_at.is_none() || work.deleted_at.is_some() { return Err(invalid("只能修改未删除的已完成作业")); }
    validate_completion(&work.category, &input)?;
    let calculated_score = completion_score(&work.category, &input);
    work.actual_minutes = Some(input.actual_minutes); work.score = calculated_score;
    work.reading_correct = input.reading_correct; work.reading_totals = input.reading_totals;
    work.listening_correct = input.listening_correct; work.listening_totals = input.listening_totals; work.updated_at = now();
    write_work(app, &work)?;
    Ok(work)
}

pub fn delete_work(app: &AppHandle, id: &str) -> io::Result<IeltsWork> {
    Uuid::parse_str(id).map_err(|_| invalid("作业 id 不正确"))?;
    let path = root(app)?.join("works").join(format!("{id}.md"));
    let mut work: IeltsWork = read_optional(&path)?.ok_or_else(|| io::Error::new(io::ErrorKind::NotFound, "作业不存在"))?;
    let timestamp = now(); work.deleted_at = Some(timestamp.clone()); work.updated_at = timestamp;
    write_work(app, &work)?;
    Ok(work)
}

pub fn restore_work(app: &AppHandle, id: &str) -> io::Result<IeltsWork> {
    Uuid::parse_str(id).map_err(|_| invalid("作业 id 不正确"))?;
    let path = root(app)?.join("works").join(format!("{id}.md"));
    let mut work: IeltsWork = read_optional(&path)?.ok_or_else(|| io::Error::new(io::ErrorKind::NotFound, "作业不存在"))?;
    work.deleted_at = None; work.updated_at = now();
    write_work(app, &work)?;
    Ok(work)
}

pub fn create_mock(app: &AppHandle, input: MockInput) -> io::Result<IeltsMock> {
    let scores = IeltsScores { reading: input.reading, listening: input.listening, writing: input.writing, speaking: input.speaking };
    validate_scores(&scores)?;
    if input.exam_at.trim().is_empty() { return Err(invalid("模考时间不能为空")); }
    let timestamp = now();
    let mock = IeltsMock { record_id: Uuid::new_v4().to_string(), exam_at: input.exam_at, reading: input.reading,
        listening: input.listening, writing: input.writing, speaking: input.speaking, notes: input.notes.trim().into(), created_at: timestamp.clone(), updated_at: timestamp };
    let path = root(app)?.join("mocks").join(format!("{}.md", mock.record_id));
    write_record(&path, "ielts_mock", "雅思模考", &mock)?;
    Ok(mock)
}

pub fn import_courses(app: &AppHandle, inputs: Vec<IeltsCourseInput>) -> io::Result<Vec<IeltsCourse>> {
    if inputs.is_empty() { return Err(invalid("雅思课程列表不能为空")); }
    let directory = root(app)?.join("courses");
    fs::create_dir_all(&directory)?;
    let existing: Vec<IeltsCourse> = read_directory(&directory, &mut Vec::new())?;
    for input in inputs {
        if input.name.trim().is_empty() || input.start_at.trim().is_empty() || input.end_at <= input.start_at {
            return Err(invalid("雅思课程名称或上课时间不正确"));
        }
        let matched = existing.iter().find(|course| course.name == input.name.trim() && course.start_at == input.start_at && course.end_at == input.end_at);
        let timestamp = now();
        let course = IeltsCourse {
            record_id: matched.map(|course| course.record_id.clone()).unwrap_or_else(|| Uuid::new_v4().to_string()),
            name: input.name.trim().into(), start_at: input.start_at, end_at: input.end_at,
            teacher: input.teacher.trim().into(), classroom: input.classroom.trim().into(), color: input.color, notes: input.notes.trim().into(),
            created_at: matched.map(|course| course.created_at.clone()).unwrap_or_else(|| timestamp.clone()), updated_at: timestamp,
        };
        write_record(&directory.join(format!("{}.md", course.record_id)), "ielts_course", &course.name, &course)?;
    }
    let mut courses = read_directory(&directory, &mut Vec::new())?;
    courses.sort_by(|a: &IeltsCourse, b| a.start_at.cmp(&b.start_at));
    Ok(courses)
}

fn write_work(app: &AppHandle, work: &IeltsWork) -> io::Result<()> {
    write_record(&root(app)?.join("works").join(format!("{}.md", work.record_id)), "ielts_work", &work.name, work)
}

fn root(app: &AppHandle) -> io::Result<PathBuf> {
    crate::storage::data_dir(app).map(|path| path.join("records").join("ielts"))
}

fn write_record<T: Serialize>(path: &Path, entity: &str, title: &str, value: &T) -> io::Result<()> {
    if let Some(parent) = path.parent() { fs::create_dir_all(parent)?; }
    let json = serde_json::to_string_pretty(value).map_err(io::Error::other)?;
    let body = format!("---\nschema_version: 1\nentity_type: {}\ntitle: {}\n---\n\n```json\n{}\n```\n", serde_json::to_string(entity).unwrap(), serde_json::to_string(title).unwrap(), json);
    let temp = path.with_extension(format!("{}.tmp", Uuid::new_v4()));
    fs::write(&temp, body)?;
    if path.exists() { fs::remove_file(path)?; }
    fs::rename(temp, path)
}

fn read_optional<T: DeserializeOwned>(path: &Path) -> io::Result<Option<T>> {
    if !path.exists() { return Ok(None); }
    let content = fs::read_to_string(path)?;
    let json = content.split_once("```json\n").and_then(|(_, rest)| rest.split_once("\n```")).map(|(json, _)| json)
        .ok_or_else(|| invalid("雅思记录格式错误"))?;
    serde_json::from_str(json).map(Some).map_err(io::Error::other)
}

fn read_directory<T: DeserializeOwned>(path: &Path, warnings: &mut Vec<String>) -> io::Result<Vec<T>> {
    if !path.exists() { return Ok(vec![]); }
    let mut output = Vec::new();
    for entry in fs::read_dir(path)? {
        let path = entry?.path();
        if path.extension().and_then(|v| v.to_str()) == Some("md") {
            match read_optional(&path) {
                Ok(Some(value)) => output.push(value),
                Ok(None) => {},
                Err(error) => warnings.push(format!("{} 读取失败: {error}", path.display())),
            }
        }
    }
    Ok(output)
}

fn validate_scores(scores: &IeltsScores) -> io::Result<()> {
    if [scores.reading, scores.listening, scores.writing, scores.speaking].iter().any(|score| !(0.0..=9.0).contains(score)) { return Err(invalid("雅思分数必须在 0 到 9 之间")); }
    Ok(())
}
fn validate_completion(category: &str, input: &CompleteInput) -> io::Result<()> {
    if input.actual_minutes == 0 { return Err(invalid("完成时间必须大于 0")); }
    let valid_score = input.score.map(|score| (0.0..=9.0).contains(&score)).unwrap_or(false);
    match category {
        "reading" => {
            let correct = input.reading_correct.as_ref().ok_or_else(|| invalid("请至少填写一篇阅读"))?;
            let totals = input.reading_totals.as_ref().ok_or_else(|| invalid("请填写阅读总题数"))?;
            if correct.is_empty() || correct.len() > 3 || correct.len() != totals.len() || correct.iter().zip(totals).any(|(right, total)| *total == 0 || *total > 15 || *right > 15 || right > total) { return Err(invalid("每篇阅读答对数不能超过 15，也不能超过该篇总题数")); }
        }
        "listening" => {
            let correct = input.listening_correct.as_ref().ok_or_else(|| invalid("请至少填写一个听力部分"))?;
            let totals = input.listening_totals.as_ref().ok_or_else(|| invalid("请填写听力各部分总题数"))?;
            if correct.is_empty() || correct.len() > 4 || correct.len() != totals.len() || correct.iter().zip(totals).any(|(right, total)| *total == 0 || *total > 10 || right > total) { return Err(invalid("听力答对数不能超过对应总题数，总题数最多 10")); }
        }
        _ if !valid_score => return Err(invalid("雅思分数必须在 0 到 9 之间")),
        _ => {}
    }
    Ok(())
}

fn automatic_band(category: &str, correct: &[u8], totals: &[u8]) -> Option<f32> {
    let correct_sum: u16 = correct.iter().map(|value| *value as u16).sum();
    let total_sum: u16 = totals.iter().map(|value| *value as u16).sum();
    if total_sum == 0 || correct_sum > total_sum { return None; }
    let raw = ((correct_sum as f32 / total_sum as f32) * 40.0).round() as u8;
    let table: &[(u8, f32)] = if category == "reading" {
        &[(39,9.0),(37,8.5),(35,8.0),(33,7.5),(30,7.0),(27,6.5),(23,6.0),(19,5.5),(15,5.0),(13,4.5),(10,4.0),(8,3.5),(6,3.0),(4,2.5),(3,2.0),(2,1.5),(1,1.0),(0,0.0)]
    } else {
        &[(39,9.0),(37,8.5),(35,8.0),(32,7.5),(30,7.0),(26,6.5),(23,6.0),(18,5.5),(16,5.0),(13,4.5),(11,4.0),(8,3.5),(6,3.0),(4,2.5),(3,2.0),(2,1.5),(1,1.0),(0,0.0)]
    };
    table.iter().find(|(minimum, _)| raw >= *minimum).map(|(_, band)| *band)
}

fn completion_score(category: &str, input: &CompleteInput) -> Option<f32> {
    match category {
        "reading" if input.reading_correct.as_ref().map(Vec::len) == Some(3) => automatic_band("reading", input.reading_correct.as_deref()?, input.reading_totals.as_deref()?),
        "listening" if input.listening_correct.as_ref().map(Vec::len) == Some(4) => automatic_band("listening", input.listening_correct.as_deref()?, input.listening_totals.as_deref()?),
        "reading" | "listening" => None,
        _ => input.score,
    }
}
fn validate_category(value: &str) -> io::Result<()> { if ["reading", "listening", "writing", "speaking"].contains(&value) { Ok(()) } else { Err(invalid("雅思科目不正确")) } }
fn normalize(value: Option<String>) -> Option<String> { value.and_then(|value| (!value.trim().is_empty()).then_some(value)) }
fn now() -> String { Local::now().to_rfc3339_opts(SecondsFormat::Secs, true) }
fn invalid(message: &str) -> io::Error { io::Error::new(io::ErrorKind::InvalidInput, message) }

#[cfg(test)]
mod tests {
    use super::*;
    #[test]
    fn validates_scores_and_required_breakdown_shapes() {
        assert!(validate_scores(&IeltsScores { reading: 9.0, listening: 8.5, writing: 6.5, speaking: 7.0 }).is_ok());
        assert!(validate_scores(&IeltsScores { reading: 9.5, listening: 8.5, writing: 6.5, speaking: 7.0 }).is_err());
        assert!(validate_category("reading").is_ok());
        assert!(validate_category("grammar").is_err());
    }

    #[test]
    fn validates_partial_reading_and_listening_results() {
        let reading = CompleteInput { actual_minutes: 30, score: None, reading_correct: Some(vec![11, 9]), reading_totals: Some(vec![13, 13]), listening_correct: None, listening_totals: None };
        assert!(validate_completion("reading", &reading).is_ok());
        let invalid_reading = CompleteInput { reading_correct: Some(vec![16]), reading_totals: Some(vec![15]), ..reading };
        assert!(validate_completion("reading", &invalid_reading).is_err());
        let listening = CompleteInput { actual_minutes: 20, score: None, reading_correct: None, reading_totals: None, listening_correct: Some(vec![7, 6, 9]), listening_totals: Some(vec![8, 9, 10]) };
        assert!(validate_completion("listening", &listening).is_ok());
    }

    #[test]
    fn automatically_converts_full_reading_and_listening_results() {
        assert_eq!(automatic_band("reading", &[10, 10, 10], &[13, 13, 14]), Some(7.0));
        assert_eq!(automatic_band("listening", &[8, 7, 7, 8], &[10, 10, 10, 10]), Some(7.0));
        assert_eq!(automatic_band("reading", &[8, 7], &[10, 10]), Some(7.0));
    }

    #[test]
    fn unreadable_record_does_not_hide_other_ielts_records() {
        let directory = std::env::temp_dir().join(format!("recent-plan-ielts-read-{}", Uuid::new_v4()));
        fs::create_dir_all(&directory).unwrap();
        fs::write(directory.join("good.md"), "```json\n\"saved record\"\n```\n").unwrap();
        fs::write(directory.join("broken.md"), "invalid record").unwrap();
        let mut warnings = Vec::new();
        let records: Vec<String> = read_directory(&directory, &mut warnings).unwrap();
        assert_eq!(records, vec!["saved record"]);
        assert_eq!(warnings.len(), 1);
        assert!(warnings[0].contains("broken.md"));
        fs::remove_dir_all(directory).unwrap();
    }
}

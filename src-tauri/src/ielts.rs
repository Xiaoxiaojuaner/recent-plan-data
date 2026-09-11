use chrono::{Local, SecondsFormat};
use serde::{de::DeserializeOwned, Deserialize, Serialize};
use std::{fs, io, path::{Path, PathBuf}};
use tauri::{AppHandle, Manager};
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
    pub score: Option<f32>, pub reading_correct: Option<Vec<u8>>, pub listening_correct: Option<Vec<u8>>,
    pub created_at: String, pub updated_at: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct IeltsMock { pub record_id: String, pub exam_at: String, pub reading: f32, pub listening: f32, pub writing: f32, pub speaking: f32, pub notes: String, pub created_at: String, pub updated_at: String }

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct IeltsData { pub goal: Option<IeltsGoal>, pub works: Vec<IeltsWork>, pub mocks: Vec<IeltsMock> }

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct WorkInput { pub name: String, pub category: String, pub due_at: Option<String>, pub expected_minutes: Option<u16> }

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct CompleteInput { pub actual_minutes: u16, pub score: f32, pub reading_correct: Option<Vec<u8>>, pub listening_correct: Option<Vec<u8>> }

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct MockInput { pub exam_at: String, pub reading: f32, pub listening: f32, pub writing: f32, pub speaking: f32, #[serde(default)] pub notes: String }

pub fn get(app: &AppHandle) -> io::Result<IeltsData> {
    let root = root(app)?;
    fs::create_dir_all(root.join("works"))?;
    fs::create_dir_all(root.join("mocks"))?;
    let goal = read_optional(&root.join("goal.md"))?;
    let mut works = read_directory(&root.join("works"))?;
    let mut mocks = read_directory(&root.join("mocks"))?;
    works.sort_by(|a: &IeltsWork, b| b.updated_at.cmp(&a.updated_at));
    mocks.sort_by(|a: &IeltsMock, b| b.exam_at.cmp(&a.exam_at));
    Ok(IeltsData { goal, works, mocks })
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
        score: None, reading_correct: None, listening_correct: None, created_at: timestamp.clone(), updated_at: timestamp };
    write_work(app, &work)?;
    Ok(work)
}

pub fn complete_work(app: &AppHandle, id: &str, input: CompleteInput) -> io::Result<IeltsWork> {
    Uuid::parse_str(id).map_err(|_| invalid("作业 id 不正确"))?;
    if !(0.0..=9.0).contains(&input.score) || input.actual_minutes == 0 { return Err(invalid("分数或完成时间不正确")); }
    let path = root(app)?.join("works").join(format!("{id}.md"));
    let mut work: IeltsWork = read_optional(&path)?.ok_or_else(|| io::Error::new(io::ErrorKind::NotFound, "作业不存在"))?;
    if work.category == "reading" && input.reading_correct.as_ref().map(Vec::len) != Some(3) { return Err(invalid("阅读需要填写 3 篇答对题数")); }
    if work.category == "listening" && input.listening_correct.as_ref().map(Vec::len) != Some(4) { return Err(invalid("听力需要填写 4 个部分答对题数")); }
    work.actual_minutes = Some(input.actual_minutes); work.score = Some(input.score);
    work.reading_correct = input.reading_correct; work.listening_correct = input.listening_correct;
    let timestamp = now(); work.completed_at = Some(timestamp.clone()); work.updated_at = timestamp;
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

fn write_work(app: &AppHandle, work: &IeltsWork) -> io::Result<()> {
    write_record(&root(app)?.join("works").join(format!("{}.md", work.record_id)), "ielts_work", &work.name, work)
}

fn root(app: &AppHandle) -> io::Result<PathBuf> {
    app.path().app_data_dir().map(|path| path.join("data").join("records").join("ielts"))
        .map_err(|error| io::Error::new(io::ErrorKind::Other, error))
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

fn read_directory<T: DeserializeOwned>(path: &Path) -> io::Result<Vec<T>> {
    if !path.exists() { return Ok(vec![]); }
    let mut output = Vec::new();
    for entry in fs::read_dir(path)? { let path = entry?.path(); if path.extension().and_then(|v| v.to_str()) == Some("md") { if let Some(value) = read_optional(&path)? { output.push(value); } } }
    Ok(output)
}

fn validate_scores(scores: &IeltsScores) -> io::Result<()> {
    if [scores.reading, scores.listening, scores.writing, scores.speaking].iter().any(|score| !(0.0..=9.0).contains(score)) { return Err(invalid("雅思分数必须在 0 到 9 之间")); }
    Ok(())
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
}

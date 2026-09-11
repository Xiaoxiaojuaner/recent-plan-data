mod storage;
mod ielts;

use storage::{Course, CourseInput, CreateTaskInput, Task, UpdateTaskInput};
use tauri::AppHandle;
use ielts::{CompleteInput, IeltsData, IeltsGoal, IeltsMock, IeltsScores, IeltsWork, MockInput, WorkInput};

#[tauri::command]
fn task_list(app: AppHandle) -> Result<Vec<Task>, String> {
    storage::list_tasks(&app).map_err(|error| error.to_string())
}

#[tauri::command]
fn task_create(app: AppHandle, input: CreateTaskInput) -> Result<Task, String> {
    storage::create_task(&app, input).map_err(|error| error.to_string())
}

#[tauri::command]
fn task_update(app: AppHandle, id: String, input: UpdateTaskInput) -> Result<Task, String> {
    storage::update_task(&app, &id, input).map_err(|error| error.to_string())
}

#[tauri::command]
fn task_set_status(app: AppHandle, id: String, status: String) -> Result<Task, String> {
    storage::set_task_status(&app, &id, &status).map_err(|error| error.to_string())
}

#[tauri::command]
fn task_delete(app: AppHandle, id: String) -> Result<(), String> {
    storage::soft_delete_task(&app, &id).map_err(|error| error.to_string())
}

#[tauri::command]
fn course_list(app: AppHandle) -> Result<Vec<Course>, String> {
    storage::list_courses(&app).map_err(|error| error.to_string())
}

#[tauri::command]
fn course_import(app: AppHandle, courses: Vec<CourseInput>) -> Result<Vec<Course>, String> {
    storage::import_courses(&app, courses).map_err(|error| error.to_string())
}

#[tauri::command]
fn ielts_get(app: AppHandle) -> Result<IeltsData, String> { ielts::get(&app).map_err(|error| error.to_string()) }
#[tauri::command]
fn ielts_save_goal(app: AppHandle, scores: IeltsScores) -> Result<IeltsGoal, String> { ielts::save_goal(&app, scores).map_err(|error| error.to_string()) }
#[tauri::command]
fn ielts_create_work(app: AppHandle, input: WorkInput) -> Result<IeltsWork, String> { ielts::create_work(&app, input).map_err(|error| error.to_string()) }
#[tauri::command]
fn ielts_complete_work(app: AppHandle, id: String, input: CompleteInput) -> Result<IeltsWork, String> { ielts::complete_work(&app, &id, input).map_err(|error| error.to_string()) }
#[tauri::command]
fn ielts_create_mock(app: AppHandle, input: MockInput) -> Result<IeltsMock, String> { ielts::create_mock(&app, input).map_err(|error| error.to_string()) }

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_opener::init())
        .setup(|app| {
            storage::initialize(&app.handle())?;
            Ok(())
        })
        .invoke_handler(tauri::generate_handler![
            task_list,
            task_create,
            task_update,
            task_set_status,
            task_delete,
            course_list,
            course_import
            ,ielts_get, ielts_save_goal, ielts_create_work, ielts_complete_work, ielts_create_mock
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}

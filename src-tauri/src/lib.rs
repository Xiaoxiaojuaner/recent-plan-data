mod ielts;
mod storage;

use ielts::{CompleteInput, IeltsCourse, IeltsCourseInput, IeltsData, IeltsGoal, IeltsMock, IeltsScores, IeltsWork, MockInput, WorkInput};
use storage::{Course, CourseInput, CourseUpdateInput, CreateTaskInput, Schedule, ScheduleImportInput, ScheduleSettings, ScheduleUpdateInput, Task, UpdateTaskInput};
use tauri::AppHandle;

#[tauri::command]
fn task_list(app: AppHandle) -> Result<Vec<Task>, String> {
    storage::synchronize(&app).map_err(|error| error.to_string())?;
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
    storage::synchronize(&app).map_err(|error| error.to_string())?;
    storage::list_courses(&app).map_err(|error| error.to_string())
}

#[tauri::command]
fn course_import(app: AppHandle, courses: Vec<CourseInput>) -> Result<Vec<Course>, String> {
    let result = storage::import_courses(&app, courses).map_err(|error| error.to_string())?;
    storage::synchronize(&app).map_err(|error| error.to_string())?;
    Ok(result)
}

#[tauri::command]
fn schedule_list(app: AppHandle) -> Result<Vec<Schedule>, String> {
    storage::synchronize(&app).map_err(|error| error.to_string())?;
    storage::list_schedules(&app).map_err(|error| error.to_string())
}

#[tauri::command]
fn schedule_import(app: AppHandle, input: ScheduleImportInput) -> Result<Vec<Course>, String> {
    let result = storage::import_schedule(&app, input).map_err(|error| error.to_string())?;
    storage::synchronize(&app).map_err(|error| error.to_string())?;
    Ok(result)
}

#[tauri::command]
fn schedule_delete(app: AppHandle, id: String) -> Result<(), String> {
    storage::delete_schedule(&app, &id).map_err(|error| error.to_string())?;
    storage::synchronize(&app).map_err(|error| error.to_string())
}

#[tauri::command]
fn schedule_update(app: AppHandle, id: String, input: ScheduleUpdateInput) -> Result<Schedule, String> { storage::update_schedule(&app, &id, input).map_err(|error| error.to_string()) }

#[tauri::command]
fn course_update(app: AppHandle, id: String, input: CourseUpdateInput) -> Result<Vec<Course>, String> { storage::update_course(&app, &id, input).map_err(|error| error.to_string()) }

#[tauri::command]
fn schedule_settings_get(app: AppHandle) -> Result<ScheduleSettings, String> {
    storage::get_schedule_settings(&app).map_err(|error| error.to_string())
}

#[tauri::command]
fn schedule_settings_save(app: AppHandle, semester_start_date: String) -> Result<ScheduleSettings, String> {
    storage::save_schedule_settings(&app, &semester_start_date).map_err(|error| error.to_string())
}

#[tauri::command]
fn ielts_get(app: AppHandle) -> Result<IeltsData, String> { storage::synchronize(&app).map_err(|error| error.to_string())?; ielts::get(&app).map_err(|error| error.to_string()) }
#[tauri::command]
fn ielts_save_goal(app: AppHandle, scores: IeltsScores) -> Result<IeltsGoal, String> { ielts::save_goal(&app, scores).map_err(|error| error.to_string()) }
#[tauri::command]
fn ielts_create_work(app: AppHandle, input: WorkInput) -> Result<IeltsWork, String> { ielts::create_work(&app, input).map_err(|error| error.to_string()) }
#[tauri::command]
fn ielts_complete_work(app: AppHandle, id: String, input: CompleteInput) -> Result<IeltsWork, String> { ielts::complete_work(&app, &id, input).map_err(|error| error.to_string()) }
#[tauri::command]
fn ielts_create_mock(app: AppHandle, input: MockInput) -> Result<IeltsMock, String> { ielts::create_mock(&app, input).map_err(|error| error.to_string()) }

#[tauri::command]
fn ielts_import_courses(app: AppHandle, courses: Vec<IeltsCourseInput>) -> Result<Vec<IeltsCourse>, String> {
    ielts::import_courses(&app, courses).map_err(|error| error.to_string())
}

#[tauri::command]
fn ielts_update_work_result(app: AppHandle, id: String, input: CompleteInput) -> Result<IeltsWork, String> {
    ielts::update_work_result(&app, &id, input).map_err(|error| error.to_string())
}

#[tauri::command]
fn ielts_delete_work(app: AppHandle, id: String) -> Result<IeltsWork, String> {
    ielts::delete_work(&app, &id).map_err(|error| error.to_string())
}

#[tauri::command]
fn ielts_restore_work(app: AppHandle, id: String) -> Result<IeltsWork, String> {
    ielts::restore_work(&app, &id).map_err(|error| error.to_string())
}

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
            course_import,
            schedule_list,
            schedule_import,
            schedule_delete,
            schedule_update,
            course_update,
            schedule_settings_get,
            schedule_settings_save,
            ielts_get,
            ielts_save_goal,
            ielts_create_work,
            ielts_complete_work,
            ielts_create_mock,
            ielts_import_courses,
            ielts_update_work_result,
            ielts_delete_work,
            ielts_restore_work
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}

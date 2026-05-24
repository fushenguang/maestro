use sqlx::sqlite::SqliteConnectOptions;
use sqlx::SqlitePool;
use tauri::Manager;

use crate::error::AppError;

/// Initialise the SQLite database for the application.
///
/// - Resolves the platform-appropriate `app_data_dir`.
/// - Creates the directory if it does not exist.
/// - Opens (or creates) `maestro.db` with WAL journal mode and foreign keys enabled.
/// - Runs all pending migrations from `src/db/migrations/`.
pub async fn init_db(app_handle: &tauri::AppHandle) -> Result<SqlitePool, AppError> {
    let app_data_dir = app_handle
        .path()
        .app_data_dir()
        .map_err(|e| AppError::Io(e.to_string()))?;

    std::fs::create_dir_all(&app_data_dir).map_err(|e| AppError::Io(e.to_string()))?;

    let db_path = app_data_dir.join("maestro.db");

    let opts = SqliteConnectOptions::new()
        .filename(&db_path)
        .create_if_missing(true)
        .foreign_keys(true)
        .journal_mode(sqlx::sqlite::SqliteJournalMode::Wal);

    let pool = SqlitePool::connect_with(opts)
        .await
        .map_err(AppError::from)?;

    // Run versioned migrations embedded at compile time.
    sqlx::migrate!("src/db/migrations")
        .run(&pool)
        .await
        .map_err(|e| AppError::Database(e.to_string()))?;

    Ok(pool)
}

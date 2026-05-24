use sqlx::SqlitePool;
use uuid::Uuid;

use crate::error::AppError;

#[derive(Debug, serde::Serialize, serde::Deserialize, sqlx::FromRow)]
#[serde(rename_all = "camelCase")]
pub struct Profile {
    pub id: String,
    pub github_login: String,
    pub github_avatar: Option<String>,
    pub display_name: Option<String>,
    pub user_type: String,
    pub domain: Option<String>,
    pub total_ideas: i64,
    pub ideas_in_market: i64,
    pub ideas_closed: i64,
    pub github_connected: bool,
    pub supabase_connected: bool,
    pub stripe_connected: bool,
    pub feishu_connected: bool,
    pub feishu_webhook_url: Option<String>,
    pub pref_opus_audit_notify: bool,
    pub pref_deadline_indicator: bool,
    pub pref_auto_export_context: bool,
    pub pref_feishu_notify: bool,
    pub created_at: String,
    pub updated_at: String,
}

#[derive(Debug, serde::Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct UpsertProfileInput {
    pub id: String,
    pub github_login: String,
    pub github_avatar: Option<String>,
    pub display_name: Option<String>,
    pub user_type: Option<String>,
    pub domain: Option<String>,
}

#[tauri::command]
pub async fn get_profile(
    pool: tauri::State<'_, SqlitePool>,
) -> Result<Option<Profile>, AppError> {
    let profile = sqlx::query_as::<_, Profile>("SELECT * FROM profiles LIMIT 1")
        .fetch_optional(pool.inner())
        .await
        .map_err(AppError::from)?;

    Ok(profile)
}

#[tauri::command]
pub async fn upsert_profile(
    pool: tauri::State<'_, SqlitePool>,
    data: UpsertProfileInput,
) -> Result<Profile, AppError> {
    let user_type = data.user_type.unwrap_or_else(|| "technical".to_string());
    let now = now_utc();

    sqlx::query(
        r#"
        INSERT INTO profiles (
          id, github_login, github_avatar, display_name, user_type, domain,
          created_at, updated_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)
        ON CONFLICT(id) DO UPDATE SET
          github_login  = excluded.github_login,
          github_avatar = excluded.github_avatar,
          display_name  = excluded.display_name,
          user_type     = excluded.user_type,
          domain        = excluded.domain,
          updated_at    = excluded.updated_at
        "#,
    )
    .bind(&data.id)
    .bind(&data.github_login)
    .bind(&data.github_avatar)
    .bind(&data.display_name)
    .bind(&user_type)
    .bind(&data.domain)
    .bind(&now)
    .bind(&now)
    .execute(pool.inner())
    .await
    .map_err(AppError::from)?;

    let profile = sqlx::query_as::<_, Profile>("SELECT * FROM profiles WHERE id = ?")
        .bind(&data.id)
        .fetch_one(pool.inner())
        .await
        .map_err(AppError::from)?;

    Ok(profile)
}

/// Generate a new UUID v4 as a string.
pub fn new_id() -> String {
    Uuid::new_v4().to_string()
}

/// Current UTC timestamp as an ISO 8601 string compatible with SQLite's `datetime()`.
pub fn now_utc() -> String {
    chrono::Utc::now().format("%Y-%m-%d %H:%M:%S").to_string()
}


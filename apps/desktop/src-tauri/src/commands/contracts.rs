use sqlx::SqlitePool;

use crate::error::AppError;
use crate::github::commit_file;
use super::profiles::{new_id, now_utc};
use crate::sync::queue::enqueue;

#[derive(Debug, serde::Serialize, serde::Deserialize, sqlx::FromRow)]
#[serde(rename_all = "camelCase")]
pub struct Contract {
    pub id: String,
    pub idea_id: String,
    pub contract_ref: String,
    pub product_type: String,
    pub deadline: String,
    pub success_metric: String,
    pub target_n: i64,
    pub github_repo: String,
    pub signed_by_user_id: Option<String>,
    pub signed_at: Option<String>,
    pub extension_requested_at: Option<String>,
    pub extension_post_url: Option<String>,
    pub extension_new_deadline: Option<String>,
    pub extension_approved_at: Option<String>,
    pub created_at: String,
}

#[derive(Debug, serde::Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct SignContractInput {
    pub product_type: String,
    pub deadline: String,
    pub success_metric: String,
    pub target_n: i64,
    pub github_repo: String,
    pub signed_by_user_id: Option<String>,
}

#[derive(Debug, serde::Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ExportContractArtifactInput {
    pub token: String,
    pub idea_id: String,
    pub owner: String,
    pub repo: String,
}

#[tauri::command]
pub async fn get_contract(
    pool: tauri::State<'_, SqlitePool>,
    idea_id: String,
) -> Result<Option<Contract>, AppError> {
    let contract = sqlx::query_as::<_, Contract>(
        "SELECT * FROM contracts WHERE idea_id = ?",
    )
    .bind(&idea_id)
    .fetch_optional(pool.inner())
    .await
    .map_err(AppError::from)?;

    Ok(contract)
}

/// Sign the product contract for an idea.
///
/// This is irreversible: sets `contracts.signed_at` and transitions
/// `ideas.status` to `'active'`.
#[tauri::command]
pub async fn sign_contract(
    pool: tauri::State<'_, SqlitePool>,
    idea_id: String,
    data: SignContractInput,
) -> Result<Contract, AppError> {
    // Prevent double-signing
    let existing_signed: Option<String> = sqlx::query_scalar(
        "SELECT signed_at FROM contracts WHERE idea_id = ?",
    )
    .bind(&idea_id)
    .fetch_optional(pool.inner())
    .await
    .map_err(AppError::from)?
    .flatten();

    if existing_signed.is_some() {
        return Err(AppError::ContractImmutable(idea_id));
    }

    let id = new_id();
    let now = now_utc();

    // Generate contract reference: CTR-{idea_prefix}-{YYYYMMDD}
    let date_part = &now[..10].replace('-', "");
    let idea_prefix = &idea_id[..6.min(idea_id.len())];
    let contract_ref = format!("CTR-{idea_prefix}-{date_part}");

    // Insert or update contract
    sqlx::query(
        r#"
        INSERT INTO contracts (
          id, idea_id, contract_ref,
          product_type, deadline, success_metric, target_n, github_repo,
          signed_by_user_id, signed_at, created_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        ON CONFLICT(idea_id) DO UPDATE SET
          product_type      = excluded.product_type,
          deadline          = excluded.deadline,
          success_metric    = excluded.success_metric,
          target_n          = excluded.target_n,
          github_repo       = excluded.github_repo,
          signed_by_user_id = excluded.signed_by_user_id,
          signed_at         = excluded.signed_at
        "#,
    )
    .bind(&id)
    .bind(&idea_id)
    .bind(&contract_ref)
    .bind(&data.product_type)
    .bind(&data.deadline)
    .bind(&data.success_metric)
    .bind(data.target_n)
    .bind(&data.github_repo)
    .bind(&data.signed_by_user_id)
    .bind(&now)
    .bind(&now)
    .execute(pool.inner())
    .await
    .map_err(AppError::from)?;

    // Transition idea status to 'active' and store immutable contract fields
    sqlx::query(
        r#"
        UPDATE ideas SET
          status             = 'active',
          contract_signed_at = ?,
          contract_id        = ?,
          product_type       = ?,
          deadline           = ?,
          success_metric     = ?,
          target_n           = ?,
          github_repo        = ?,
          updated_at         = ?
        WHERE id = ?
        "#,
    )
    .bind(&now)
    .bind(&contract_ref)
    .bind(&data.product_type)
    .bind(&data.deadline)
    .bind(&data.success_metric)
    .bind(data.target_n)
    .bind(&data.github_repo)
    .bind(&now)
    .bind(&idea_id)
    .execute(pool.inner())
    .await
    .map_err(AppError::from)?;

    let contract = sqlx::query_as::<_, Contract>("SELECT * FROM contracts WHERE idea_id = ?")
        .bind(&idea_id)
        .fetch_one(pool.inner())
        .await
        .map_err(AppError::from)?;

    let payload = serde_json::to_string(&contract).unwrap_or_default();
    let _ = enqueue(pool.inner(), "contracts", &contract.id, "upsert", &payload).await;

    Ok(contract)
}

#[tauri::command]
pub async fn export_contract_artifact(
    pool: tauri::State<'_, SqlitePool>,
    data: ExportContractArtifactInput,
) -> Result<String, AppError> {
    let contract = sqlx::query_as::<_, Contract>("SELECT * FROM contracts WHERE idea_id = ?")
        .bind(&data.idea_id)
        .fetch_optional(pool.inner())
        .await
        .map_err(AppError::from)?
        .ok_or_else(|| AppError::NotFound(data.idea_id.clone()))?;

    let content = serde_json::to_string_pretty(&contract)
        .map_err(|e| AppError::ValidationError(e.to_string()))?;

    let sha = commit_file(
        &data.token,
        &data.owner,
        &data.repo,
        ".maestro/contract.json",
        &content,
        &format!("chore(contract): export {}", contract.contract_ref),
    )
    .await
    .map_err(AppError::RepoVerifyFailed)?;

    Ok(sha)
}

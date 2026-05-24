use sqlx::SqlitePool;

use crate::error::AppError;
use super::profiles::{new_id, now_utc};

#[derive(Debug, serde::Serialize, serde::Deserialize, sqlx::FromRow)]
#[serde(rename_all = "camelCase")]
pub struct ValidationReport {
    pub id: String,
    pub idea_id: String,
    pub verdict: Option<String>,
    pub verdict_summary: Option<String>,
    pub market_size_signal: Option<String>,
    pub competing_products: Option<i64>,
    pub paying_customers_found: Option<i64>,
    pub advocate_go_reasons: String,     // JSON array
    pub advocate_evidence: String,       // JSON
    pub advocate_completed_at: Option<String>,
    pub prosecutor_risks: String,        // JSON array
    pub prosecutor_evidence: String,     // JSON
    pub prosecutor_completed_at: Option<String>,
    pub synthesis_notes: Option<String>,
    pub evidence_gaps: String,           // JSON array
    pub model_used: Option<String>,
    pub generated_at: String,
}

#[derive(Debug, serde::Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct UpsertValidationReportInput {
    pub idea_id: String,
    pub verdict: Option<String>,
    pub verdict_summary: Option<String>,
    pub market_size_signal: Option<String>,
    pub competing_products: Option<i64>,
    pub paying_customers_found: Option<i64>,
    pub advocate_go_reasons: Option<Vec<String>>,
    pub advocate_completed_at: Option<String>,
    pub prosecutor_risks: Option<Vec<String>>,
    pub prosecutor_completed_at: Option<String>,
    pub synthesis_notes: Option<String>,
    pub evidence_gaps: Option<Vec<String>>,
    pub model_used: Option<String>,
}

#[derive(Debug, serde::Serialize, serde::Deserialize, sqlx::FromRow)]
#[serde(rename_all = "camelCase")]
pub struct EvidenceItem {
    pub id: String,
    pub idea_id: String,
    pub pass_type: String,
    pub badge: String,
    pub title: String,
    pub description: String,
    pub source_url: Option<String>,
    pub sort_order: i64,
    pub created_at: String,
}

#[derive(Debug, serde::Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct AddEvidenceItemInput {
    pub idea_id: String,
    pub pass_type: String,
    pub badge: String,
    pub title: String,
    pub description: String,
    pub source_url: Option<String>,
    pub sort_order: Option<i64>,
}

#[tauri::command]
pub async fn get_validation_report(
    pool: tauri::State<'_, SqlitePool>,
    idea_id: String,
) -> Result<Option<ValidationReport>, AppError> {
    let report = sqlx::query_as::<_, ValidationReport>(
        "SELECT * FROM validation_reports WHERE idea_id = ?",
    )
    .bind(&idea_id)
    .fetch_optional(pool.inner())
    .await
    .map_err(AppError::from)?;

    Ok(report)
}

#[tauri::command]
pub async fn upsert_validation_report(
    pool: tauri::State<'_, SqlitePool>,
    data: UpsertValidationReportInput,
) -> Result<ValidationReport, AppError> {
    let existing = sqlx::query_scalar::<_, String>(
        "SELECT id FROM validation_reports WHERE idea_id = ?",
    )
    .bind(&data.idea_id)
    .fetch_optional(pool.inner())
    .await
    .map_err(AppError::from)?;

    let id = existing.unwrap_or_else(new_id);
    let now = now_utc();

    let advocate_go_reasons = serde_json::to_string(
        &data.advocate_go_reasons.unwrap_or_default(),
    )
    .unwrap_or_else(|_| "[]".to_string());

    let prosecutor_risks = serde_json::to_string(
        &data.prosecutor_risks.unwrap_or_default(),
    )
    .unwrap_or_else(|_| "[]".to_string());

    let evidence_gaps = serde_json::to_string(
        &data.evidence_gaps.unwrap_or_default(),
    )
    .unwrap_or_else(|_| "[]".to_string());

    sqlx::query(
        r#"
        INSERT INTO validation_reports (
          id, idea_id, verdict, verdict_summary,
          market_size_signal, competing_products, paying_customers_found,
          advocate_go_reasons, advocate_completed_at,
          prosecutor_risks, prosecutor_completed_at,
          synthesis_notes, evidence_gaps, model_used, generated_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        ON CONFLICT(idea_id) DO UPDATE SET
          verdict                 = COALESCE(excluded.verdict, verdict),
          verdict_summary         = COALESCE(excluded.verdict_summary, verdict_summary),
          market_size_signal      = COALESCE(excluded.market_size_signal, market_size_signal),
          competing_products      = COALESCE(excluded.competing_products, competing_products),
          paying_customers_found  = COALESCE(excluded.paying_customers_found, paying_customers_found),
          advocate_go_reasons     = excluded.advocate_go_reasons,
          advocate_completed_at   = COALESCE(excluded.advocate_completed_at, advocate_completed_at),
          prosecutor_risks        = excluded.prosecutor_risks,
          prosecutor_completed_at = COALESCE(excluded.prosecutor_completed_at, prosecutor_completed_at),
          synthesis_notes         = COALESCE(excluded.synthesis_notes, synthesis_notes),
          evidence_gaps           = excluded.evidence_gaps,
          model_used              = COALESCE(excluded.model_used, model_used),
          generated_at            = excluded.generated_at
        "#,
    )
    .bind(&id)
    .bind(&data.idea_id)
    .bind(&data.verdict)
    .bind(&data.verdict_summary)
    .bind(&data.market_size_signal)
    .bind(data.competing_products)
    .bind(data.paying_customers_found)
    .bind(&advocate_go_reasons)
    .bind(&data.advocate_completed_at)
    .bind(&prosecutor_risks)
    .bind(&data.prosecutor_completed_at)
    .bind(&data.synthesis_notes)
    .bind(&evidence_gaps)
    .bind(&data.model_used)
    .bind(&now)
    .execute(pool.inner())
    .await
    .map_err(AppError::from)?;

    let report = sqlx::query_as::<_, ValidationReport>(
        "SELECT * FROM validation_reports WHERE idea_id = ?",
    )
    .bind(&data.idea_id)
    .fetch_one(pool.inner())
    .await
    .map_err(AppError::from)?;

    Ok(report)
}

#[tauri::command]
pub async fn get_evidence_items(
    pool: tauri::State<'_, SqlitePool>,
    idea_id: String,
) -> Result<Vec<EvidenceItem>, AppError> {
    let items = sqlx::query_as::<_, EvidenceItem>(
        "SELECT * FROM evidence_items WHERE idea_id = ? ORDER BY sort_order ASC, created_at ASC",
    )
    .bind(&idea_id)
    .fetch_all(pool.inner())
    .await
    .map_err(AppError::from)?;

    Ok(items)
}

#[tauri::command]
pub async fn add_evidence_item(
    pool: tauri::State<'_, SqlitePool>,
    data: AddEvidenceItemInput,
) -> Result<EvidenceItem, AppError> {
    let id = new_id();
    let now = now_utc();
    let sort_order = data.sort_order.unwrap_or(0);

    sqlx::query(
        r#"
        INSERT INTO evidence_items (id, idea_id, pass_type, badge, title, description, source_url, sort_order, created_at)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
        "#,
    )
    .bind(&id)
    .bind(&data.idea_id)
    .bind(&data.pass_type)
    .bind(&data.badge)
    .bind(&data.title)
    .bind(&data.description)
    .bind(&data.source_url)
    .bind(sort_order)
    .bind(&now)
    .execute(pool.inner())
    .await
    .map_err(AppError::from)?;

    let item = sqlx::query_as::<_, EvidenceItem>("SELECT * FROM evidence_items WHERE id = ?")
        .bind(&id)
        .fetch_one(pool.inner())
        .await
        .map_err(AppError::from)?;

    Ok(item)
}

use chrono::{NaiveDate, Utc};
use reqwest::header::{ACCEPT, USER_AGENT};
use serde_json::Value;
use sqlx::SqlitePool;

use crate::error::AppError;
use super::profiles::now_utc;

#[derive(Debug, serde::Serialize)]
#[serde(rename_all = "camelCase")]
pub struct RepoVerifyResult {
    pub ok: bool,
    pub owner: Option<String>,
    pub repo: Option<String>,
    pub message: String,
}

#[derive(Debug, serde::Serialize)]
#[serde(rename_all = "camelCase")]
pub struct MarketRefreshResult {
    pub idea_id: String,
    pub success_metric: String,
    pub current_value: Option<i64>,
    pub updated_status: Option<String>,
    pub refreshed: bool,
    pub message: String,
}

#[derive(Debug, serde::Serialize)]
#[serde(rename_all = "camelCase")]
pub struct DueIdeasStatusResult {
    pub refreshed_count: i64,
    pub changed_status_count: i64,
}

fn parse_repo_identifier(input: &str) -> Option<(String, String)> {
    let trimmed = input.trim().trim_start_matches("https://github.com/").trim_end_matches('/');
    let parts: Vec<&str> = trimmed.split('/').filter(|p| !p.trim().is_empty()).collect();
    if parts.len() != 2 {
        return None;
    }

    Some((parts[0].to_string(), parts[1].to_string()))
}

async fn fetch_github_stars(owner: &str, repo: &str) -> Result<i64, AppError> {
    let url = format!("https://api.github.com/repos/{owner}/{repo}");
    let response = reqwest::Client::new()
        .get(url)
        .header(USER_AGENT, "maestro-desktop")
        .header(ACCEPT, "application/vnd.github+json")
        .send()
        .await
        .map_err(|e| AppError::MarketRefreshFailed(e.to_string()))?;

    if !response.status().is_success() {
        return Err(AppError::MarketRefreshFailed(format!(
            "GitHub API returned {}",
            response.status()
        )));
    }

    let payload: Value = response
        .json()
        .await
        .map_err(|e| AppError::MarketRefreshFailed(e.to_string()))?;

    let stars = payload
        .get("stargazers_count")
        .and_then(|v| v.as_i64())
        .ok_or_else(|| AppError::MarketRefreshFailed("Missing stargazers_count".to_string()))?;

    Ok(stars)
}

fn evaluate_status(deadline: Option<&str>, target_n: Option<i64>, current_value: i64) -> Option<String> {
    let target = target_n?;
    if current_value >= target {
        return Some("in_market".to_string());
    }

    let deadline = deadline?;
    let date = NaiveDate::parse_from_str(deadline, "%Y-%m-%d").ok()?;
    let today = Utc::now().date_naive();
    let days = (date - today).num_days();

    if days < 0 {
        return Some("force_closed".to_string());
    }

    if days < 14 {
        return Some("at_risk".to_string());
    }

    Some("active".to_string())
}

#[tauri::command]
pub async fn verify_github_repo(repo: String) -> Result<RepoVerifyResult, AppError> {
    let (owner, name) = parse_repo_identifier(&repo)
        .ok_or_else(|| AppError::RepoVerifyFailed("Expected owner/repo format".to_string()))?;

    let url = format!("https://api.github.com/repos/{owner}/{name}");
    let response = reqwest::Client::new()
        .get(url)
        .header(USER_AGENT, "maestro-desktop")
        .header(ACCEPT, "application/vnd.github+json")
        .send()
        .await
        .map_err(|e| AppError::RepoVerifyFailed(e.to_string()))?;

    if !response.status().is_success() {
        return Err(AppError::RepoVerifyFailed(format!(
            "Repository not accessible (status {})",
            response.status()
        )));
    }

    Ok(RepoVerifyResult {
        ok: true,
        owner: Some(owner),
        repo: Some(name),
        message: "Repository verified".to_string(),
    })
}

#[tauri::command]
pub async fn refresh_market_signal(
    pool: tauri::State<'_, SqlitePool>,
    idea_id: String,
) -> Result<MarketRefreshResult, AppError> {
    let row = sqlx::query_as::<_, (Option<String>, Option<i64>, Option<String>, i64)>(
        "SELECT success_metric, target_n, deadline, market_current_value FROM ideas WHERE id = ?",
    )
    .bind(&idea_id)
    .fetch_optional(pool.inner())
    .await
    .map_err(AppError::from)?
    .ok_or_else(|| AppError::NotFound(idea_id.clone()))?;

    let (metric, target_n, deadline, current_db_value) = row;
    let metric = metric.unwrap_or_default();

    if metric != "github_stars" {
        return Ok(MarketRefreshResult {
            idea_id,
            success_metric: metric,
            current_value: None,
            updated_status: None,
            refreshed: false,
            message: "Metric is manual/unsupported for auto refresh".to_string(),
        });
    }

    let repo: Option<String> = sqlx::query_scalar("SELECT github_repo FROM ideas WHERE id = ?")
        .bind(&idea_id)
        .fetch_optional(pool.inner())
        .await
        .map_err(AppError::from)?
        .flatten();

    let repo = repo.ok_or_else(|| {
        AppError::MarketRefreshFailed("Missing github_repo for github_stars metric".to_string())
    })?;

    let (owner, name) = parse_repo_identifier(&repo)
        .ok_or_else(|| AppError::MarketRefreshFailed("Invalid github_repo format".to_string()))?;

    let stars = fetch_github_stars(&owner, &name).await?;
    let status = evaluate_status(deadline.as_deref(), target_n, stars);
    let now = now_utc();

    sqlx::query(
        r#"
        UPDATE ideas SET
          market_current_value = ?,
          market_last_checked_at = ?,
          status = COALESCE(?, status),
          updated_at = ?
        WHERE id = ?
        "#,
    )
    .bind(stars)
    .bind(&now)
    .bind(&status)
    .bind(&now)
    .bind(&idea_id)
    .execute(pool.inner())
    .await
    .map_err(AppError::from)?;

    Ok(MarketRefreshResult {
        idea_id,
        success_metric: metric,
        current_value: Some(stars),
        updated_status: status,
        refreshed: stars != current_db_value,
        message: "Market signal refreshed".to_string(),
    })
}

pub async fn refresh_due_ideas_status_inner(pool: &SqlitePool) -> Result<DueIdeasStatusResult, AppError> {
    let ideas = sqlx::query_as::<_, (String, Option<String>, Option<i64>, Option<String>, Option<String>, i64)>(
        "SELECT id, success_metric, target_n, deadline, github_repo, market_current_value FROM ideas WHERE contract_signed_at IS NOT NULL",
    )
    .fetch_all(pool)
    .await
    .map_err(AppError::from)?;

    let mut refreshed_count = 0_i64;
    let mut changed_status_count = 0_i64;

    for (idea_id, metric, target_n, deadline, github_repo, current_value) in ideas {
        let metric = metric.unwrap_or_default();
        let mut latest_value = current_value;

        if metric == "github_stars" {
            if let Some(repo) = github_repo {
                if let Some((owner, name)) = parse_repo_identifier(&repo) {
                    if let Ok(stars) = fetch_github_stars(&owner, &name).await {
                        latest_value = stars;
                        refreshed_count += 1;
                    }
                }
            }
        }

        let next_status = evaluate_status(deadline.as_deref(), target_n, latest_value);
        let now = now_utc();

        let result = sqlx::query(
            r#"
            UPDATE ideas
            SET
              market_current_value = ?,
              market_last_checked_at = ?,
              status = COALESCE(?, status),
              updated_at = ?
            WHERE id = ? AND status != COALESCE(?, status)
            "#,
        )
        .bind(latest_value)
        .bind(&now)
        .bind(&next_status)
        .bind(&now)
        .bind(&idea_id)
        .bind(&next_status)
        .execute(pool)
        .await
        .map_err(AppError::from)?;

        if result.rows_affected() > 0 {
            changed_status_count += 1;
        }
    }

    Ok(DueIdeasStatusResult {
        refreshed_count,
        changed_status_count,
    })
}

#[tauri::command]
pub async fn refresh_due_ideas_status(
    pool: tauri::State<'_, SqlitePool>,
) -> Result<DueIdeasStatusResult, AppError> {
    refresh_due_ideas_status_inner(pool.inner()).await
}

#[cfg(test)]
mod tests {
    use super::evaluate_status;

    #[test]
    fn evaluate_status_target_reached() {
        let status = evaluate_status(Some("2099-01-01"), Some(100), 100);
        assert_eq!(status.as_deref(), Some("in_market"));
    }

    #[test]
    fn evaluate_status_near_deadline() {
        let today = chrono::Utc::now().date_naive();
        let near = (today + chrono::Duration::days(3)).format("%Y-%m-%d").to_string();
        let status = evaluate_status(Some(&near), Some(100), 10);
        assert_eq!(status.as_deref(), Some("at_risk"));
    }

    #[test]
    fn evaluate_status_overdue() {
        let today = chrono::Utc::now().date_naive();
        let overdue = (today - chrono::Duration::days(1)).format("%Y-%m-%d").to_string();
        let status = evaluate_status(Some(&overdue), Some(100), 10);
        assert_eq!(status.as_deref(), Some("force_closed"));
    }
}

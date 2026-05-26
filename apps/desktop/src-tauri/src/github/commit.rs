use base64::Engine;
use serde::{Deserialize, Serialize};

use super::client::GitHubClient;

/// Payload for serializing `.maestro/boundary.json`.
#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct BoundaryJson {
    pub idea_id: String,
    pub locked_at: String,
    pub problem_statement: String,
    pub in_scope: Vec<ScopeEntry>,
    pub out_of_scope: Vec<ScopeEntry>,
    pub open_questions: Vec<ScopeEntry>,
    pub intent_canvas: serde_json::Value,
}

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct ScopeEntry {
    pub title: String,
    pub description: Option<String>,
}

/// Response from the GitHub Contents API PUT endpoint.
#[derive(Debug, Deserialize)]
struct GitHubContentsResponse {
    commit: GitHubCommit,
}

#[derive(Debug, Deserialize)]
struct GitHubCommit {
    sha: String,
}

/// Response body for GET /repos/{owner}/{repo}/contents/{path}
/// used to obtain the existing file SHA for updates.
#[derive(Debug, Deserialize)]
struct ExistingFile {
    sha: String,
}

/// Commit a file to a GitHub repository using the Contents API.
///
/// - `token`:   GitHub OAuth access token (from Supabase session.provider_token)
/// - `owner`:   Repository owner (user or org)
/// - `repo`:    Repository name
/// - `path`:    File path inside the repo (e.g. `.maestro/boundary.json`)
/// - `content`: Raw file content (will be Base64-encoded)
/// - `message`: Commit message
///
/// Returns the commit SHA on success.
pub async fn commit_file(
    token: &str,
    owner: &str,
    repo: &str,
    path: &str,
    content: &str,
    message: &str,
) -> Result<String, String> {
    let client = GitHubClient::new(token);
    let url = format!(
        "https://api.github.com/repos/{owner}/{repo}/contents/{path}"
    );

    // Encode content as Base64
    let encoded = base64::engine::general_purpose::STANDARD.encode(content.as_bytes());

    // Check if the file already exists (we need its SHA for updates)
    let existing_resp = client
        .http
        .get(&url)
        .header("Authorization", format!("Bearer {}", client.token))
        .header("Accept", "application/vnd.github+json")
        .header("User-Agent", "maestro-desktop/0.1")
        .header("X-GitHub-Api-Version", "2022-11-28")
        .send()
        .await
        .ok();

    let existing_sha: Option<String> = match existing_resp {
        Some(resp) if resp.status().is_success() => resp
            .json::<ExistingFile>()
            .await
            .ok()
            .map(|f| f.sha),
        _ => None,
    };

    // Build the PUT body
    let mut body = serde_json::json!({
        "message": message,
        "content": encoded,
    });

    if let Some(sha) = existing_sha {
        body["sha"] = serde_json::json!(sha);
    }

    let resp = client
        .http
        .put(&url)
        .header("Authorization", format!("Bearer {}", client.token))
        .header("Accept", "application/vnd.github+json")
        .header("User-Agent", "maestro-desktop/0.1")
        .header("X-GitHub-Api-Version", "2022-11-28")
        .json(&body)
        .send()
        .await
        .map_err(|e| format!("network error: {e}"))?;

    if !resp.status().is_success() {
        let status = resp.status();
        let text = resp.text().await.unwrap_or_default();
        return Err(format!("GitHub API error {status}: {text}"));
    }

    let result: GitHubContentsResponse = resp
        .json()
        .await
        .map_err(|e| format!("parse error: {e}"))?;

    Ok(result.commit.sha)
}

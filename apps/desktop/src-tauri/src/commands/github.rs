use crate::github::commit_file;

#[derive(Debug, serde::Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct CommitFileInput {
    pub token: String,
    pub owner: String,
    pub repo: String,
    pub path: String,
    pub content: String,
    pub message: String,
}

/// Commit a file to a GitHub repository.
/// Returns the commit SHA on success, or an error message string.
#[tauri::command]
pub async fn github_commit_file(data: CommitFileInput) -> Result<String, String> {
    commit_file(
        &data.token,
        &data.owner,
        &data.repo,
        &data.path,
        &data.content,
        &data.message,
    )
    .await
}

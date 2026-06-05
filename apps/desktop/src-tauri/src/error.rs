/// Unified application error type returned by all Tauri commands.
///
/// Must implement `serde::Serialize` so Tauri can propagate errors to the frontend.
#[derive(Debug, serde::Serialize)]
#[serde(tag = "type", content = "message")]
pub enum AppError {
    /// Underlying database / sqlx error.
    Database(String),
    /// Attempted to mutate immutable contract fields after signing.
    ContractImmutable(String),
    /// Requested entity was not found.
    NotFound(String),
    /// Business-rule validation failure.
    ValidationError(String),
    /// Filesystem / IO error.
    Io(String),
    /// LLM service error (config, HTTP, parsing).
    LlmError(String),
    /// GitHub repository verification failed.
    RepoVerifyFailed(String),
    /// Market signal refresh failed.
    MarketRefreshFailed(String),
}

impl From<sqlx::Error> for AppError {
    fn from(e: sqlx::Error) -> Self {
        AppError::Database(e.to_string())
    }
}

impl std::fmt::Display for AppError {
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        match self {
            AppError::Database(msg) => write!(f, "Database error: {msg}"),
            AppError::ContractImmutable(id) => {
                write!(f, "Contract is immutable after signing (idea: {id})")
            }
            AppError::NotFound(id) => write!(f, "Not found: {id}"),
            AppError::ValidationError(msg) => write!(f, "Validation error: {msg}"),
            AppError::Io(msg) => write!(f, "IO error: {msg}"),
            AppError::LlmError(msg) => write!(f, "LLM error: {msg}"),
            AppError::RepoVerifyFailed(msg) => write!(f, "Repository verification failed: {msg}"),
            AppError::MarketRefreshFailed(msg) => write!(f, "Market refresh failed: {msg}"),
        }
    }
}

impl std::error::Error for AppError {}

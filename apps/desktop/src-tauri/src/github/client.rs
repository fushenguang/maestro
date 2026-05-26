use reqwest::Client;

/// GitHub API client wrapping `reqwest`.
pub struct GitHubClient {
    pub http: Client,
    pub token: String,
}

impl GitHubClient {
    /// Create a new client with the provided GitHub OAuth token.
    pub fn new(token: impl Into<String>) -> Self {
        Self {
            http: Client::new(),
            token: token.into(),
        }
    }
}

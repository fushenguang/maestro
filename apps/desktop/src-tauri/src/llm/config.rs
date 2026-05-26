use std::fs;
use std::path::PathBuf;
use serde::{Deserialize, Serialize};

/// LLM provider configuration stored as a JSON file in the app data directory.
#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct LlmConfig {
    pub api_key: String,
    pub base_url: String,
    pub model: String,
}

impl Default for LlmConfig {
    fn default() -> Self {
        Self {
            api_key: String::new(),
            base_url: "https://api.minimax.io/v1".to_string(),
            model: "abab6.5s-chat".to_string(),
        }
    }
}

fn config_path(app_data_dir: &PathBuf) -> PathBuf {
    app_data_dir.join("llm_config.json")
}

pub fn load(app_data_dir: &PathBuf) -> LlmConfig {
    let path = config_path(app_data_dir);
    fs::read_to_string(&path)
        .ok()
        .and_then(|s| serde_json::from_str(&s).ok())
        .unwrap_or_default()
}

pub fn save(app_data_dir: &PathBuf, config: &LlmConfig) -> Result<(), String> {
    let path = config_path(app_data_dir);
    if let Some(parent) = path.parent() {
        fs::create_dir_all(parent).map_err(|e| e.to_string())?;
    }
    let content = serde_json::to_string_pretty(config).map_err(|e| e.to_string())?;
    fs::write(&path, content).map_err(|e| e.to_string())
}

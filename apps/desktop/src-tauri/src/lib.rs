mod commands;
mod db;
mod error;
mod github;
mod llm;
mod sync;

use tauri::Manager;

/// Runtime configuration loaded from environment variables.
pub struct AppConfig {
    pub supabase_url: String,
    pub supabase_anon_key: String,
}

pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_deep_link::init())
        .plugin(tauri_plugin_shell::init())
        .plugin(tauri_plugin_sql::Builder::default().build())
        .setup(|app| {
            let handle = app.handle().clone();

            // On Windows/Linux, register the URL scheme dynamically so deep links
            // work in dev mode. On macOS, the scheme is declared in Info.plist and
            // only active when running as a signed .app bundle (not in tauri dev).
            #[cfg(not(target_os = "macos"))]
            {
                use tauri_plugin_deep_link::DeepLinkExt;
                let _ = app.deep_link().register("maestro");
            }

            // Initialise SQLite database synchronously before the window opens.
            let pool = tauri::async_runtime::block_on(db::init_db(&handle))
                .expect("Failed to initialise database");

            // Inject pool into Tauri state so all commands can access it.
            app.manage(pool.clone());

            // Load Supabase config from environment (empty strings = sync disabled).
            let config = AppConfig {
                supabase_url: std::env::var("SUPABASE_URL").unwrap_or_default(),
                supabase_anon_key: std::env::var("SUPABASE_ANON_KEY").unwrap_or_default(),
            };

            // Spawn the background sync worker (non-blocking).
            sync::worker::spawn(pool, config.supabase_url, config.supabase_anon_key);

            Ok(())
        })
        .invoke_handler(tauri::generate_handler![
            // profiles
            commands::profiles::get_profile,
            commands::profiles::upsert_profile,
            // ideas
            commands::ideas::get_ideas,
            commands::ideas::get_idea,
            commands::ideas::create_idea,
            commands::ideas::update_idea,
            commands::ideas::delete_idea,
            // dialogue
            commands::dialogue::get_dialogue_messages,
            commands::dialogue::add_dialogue_message,
            // intent canvas
            commands::intent::get_intent_canvas,
            commands::intent::upsert_intent_canvas,
            // boundary / scope
            commands::boundary::get_scope_items,
            commands::boundary::upsert_scope_item,
            commands::boundary::delete_scope_item,
            commands::boundary::delete_scope_items_by_source,
            commands::boundary::lock_boundary,
            // validation
            commands::validation::get_validation_report,
            commands::validation::upsert_validation_report,
            commands::validation::get_evidence_items,
            commands::validation::add_evidence_item,
            commands::validation::delete_evidence_items,
            commands::validation::delete_validation_report,
            // contracts
            commands::contracts::get_contract,
            commands::contracts::sign_contract,
            // evolution
            commands::evolution::get_evolution_nodes,
            commands::evolution::create_evolution_node,
            commands::evolution::get_openspec_changes,
            // llm
            commands::llm::llm_chat_stream,
            commands::llm::llm_set_config,
            commands::llm::llm_get_config,
            // github
            commands::github::github_commit_file,
        ])
        .run(tauri::generate_context!())
        .expect("error while running Maestro desktop shell");
}

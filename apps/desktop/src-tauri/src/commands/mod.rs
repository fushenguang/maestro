pub mod boundary;
pub mod contracts;
pub mod dialogue;
pub mod evolution;
pub mod github;
pub mod ideas;
pub mod intent;
pub mod llm;
pub mod market_signals;
pub mod profiles;
pub mod validation;

use tauri::Builder;

/// Register all Tauri commands with the application builder.
pub fn register<R: tauri::Runtime>(builder: Builder<R>) -> Builder<R> {
    builder.invoke_handler(tauri::generate_handler![
        // profiles
        profiles::get_profile,
        profiles::upsert_profile,
        // ideas
        ideas::get_ideas,
        ideas::get_idea,
        ideas::create_idea,
        ideas::update_idea,
        ideas::delete_idea,
        // dialogue
        dialogue::get_dialogue_messages,
        dialogue::add_dialogue_message,
        // intent canvas
        intent::get_intent_canvas,
        intent::upsert_intent_canvas,
        // boundary / scope
        boundary::get_scope_items,
        boundary::upsert_scope_item,
        boundary::delete_scope_item,
        boundary::delete_scope_items_by_source,
        boundary::lock_boundary,
        // validation
        validation::get_validation_report,
        validation::upsert_validation_report,
        validation::get_evidence_items,
        validation::add_evidence_item,
        validation::delete_evidence_items,
        validation::delete_validation_report,
        // contracts
        contracts::get_contract,
        contracts::sign_contract,
        contracts::export_contract_artifact,
        // evolution
        evolution::get_evolution_nodes,
        evolution::create_evolution_node,
        evolution::get_openspec_changes,
        evolution::get_arch_decision_logs,
        evolution::dismiss_scope_warning,
        evolution::complete_openspec_change_with_arch_log,
        // market signals
        market_signals::verify_github_repo,
        market_signals::refresh_market_signal,
        market_signals::refresh_due_ideas_status,
    ])
}

# 09-TAURI-DESKTOP.md — Tauri v2 桌面应用

> **应用位置**：`apps/desktop/`
> **Tauri 版本**：v2.11.x（当前最新稳定版）
> **前端**：React 19 + Vite + shadcn/ui + TanStack Router

---

## 1. 应用架构

```
apps/desktop/
├── src/                          ← React 前端（WebView 中运行）
│   ├── main.tsx                  ← React 入口
│   ├── router.tsx                ← TanStack Router 配置
│   ├── routes/
│   │   ├── __root.tsx            ← 根布局
│   │   ├── index.tsx             ← Dashboard（首页）
│   │   ├── issues/
│   │   │   ├── index.tsx         ← Issue 列表
│   │   │   └── $issueId.tsx      ← Issue 详情
│   │   ├── settings/
│   │   │   └── index.tsx         ← 设置页（WORKFLOW.md 编辑、API keys）
│   │   └── sessions/
│   │       └── $sessionId.tsx    ← Agent 会话详情
│   ├── components/               ← 桌面专属组件
│   ├── hooks/
│   │   ├── useSymphonyCore.ts    ← 与 Tauri sidecar 通信
│   │   └── useRealtimeIssues.ts  ← Supabase Realtime
│   └── stores/
│       └── symphonyStore.ts      ← Zustand 全局状态
│
└── src-tauri/                    ← Rust 后端
    ├── Cargo.toml
    ├── tauri.conf.json
    ├── capabilities/
    │   └── default.json           ← Tauri v2 能力声明
    └── src/
        ├── main.rs
        ├── lib.rs
        └── commands/
            ├── orchestrator.rs    ← Orchestrator IPC commands
            ├── workspace.rs       ← 文件系统操作
            └── system.rs          ← 系统信息
```

---

## 2. Tauri 配置

### `tauri.conf.json`（关键部分）

```json
{
  "$schema": "https://schema.tauri.app/config/2",
  "productName": "Symphony",
  "version": "0.1.0",
  "identifier": "com.yourteam.symphony",
  "build": {
    "beforeDevCommand": "pnpm dev:vite",
    "beforeBuildCommand": "pnpm build:vite",
    "devUrl": "http://localhost:1420",
    "frontendDist": "../dist"
  },
  "app": {
    "windows": [
      {
        "title": "Symphony",
        "width": 1280,
        "height": 800,
        "minWidth": 900,
        "minHeight": 600,
        "decorations": true,
        "transparent": false,
        "resizable": true
      }
    ],
    "security": {
      "csp": "default-src 'self'; connect-src 'self' http://localhost:54321 ws://localhost:54321"
    }
  },
  "bundle": {
    "active": true,
    "targets": "all",
    "icon": ["icons/32x32.png", "icons/128x128.png", "icons/128x128@2x.png", "icons/icon.icns", "icons/icon.ico"]
  }
}
```

### `capabilities/default.json`（Tauri v2 能力声明）

```json
{
  "$schema": "https://schema.tauri.app/schema/capability/2",
  "identifier": "default",
  "description": "Default capabilities for Symphony desktop app",
  "platforms": ["linux", "macOS", "windows"],
  "permissions": [
    "core:default",
    "core:window:allow-start-dragging",
    "core:app:allow-version",
    "shell:allow-execute",
    "fs:allow-read-text-file",
    "fs:allow-write-text-file",
    "fs:allow-read-dir",
    "fs:allow-mkdir",
    "fs:allow-remove",
    "dialog:allow-open",
    "dialog:allow-save",
    "process:allow-exit",
    "orchestrator:allow-start",
    "orchestrator:allow-stop",
    "orchestrator:allow-get-status"
  ]
}
```

---

## 3. Rust Commands（IPC Bridge）

### `src-tauri/src/commands/orchestrator.rs`

```rust
use tauri::State;
use serde::{Deserialize, Serialize};

#[derive(Debug, Serialize)]
pub struct OrchestratorStatus {
    pub is_running: bool,
    pub running_agents: u32,
    pub total_dispatched: u64,
}

// Tauri v2: 使用 #[tauri::command] + async
#[tauri::command]
pub async fn start_orchestrator() -> Result<(), String> {
    // 启动 Node.js sidecar（packages/core 编译后的产物）
    // 或通过 IPC 通知已运行的 sidecar 进程
    Ok(())
}

#[tauri::command]
pub async fn stop_orchestrator() -> Result<(), String> {
    Ok(())
}

#[tauri::command]
pub async fn get_orchestrator_status() -> Result<OrchestratorStatus, String> {
    Ok(OrchestratorStatus {
        is_running: true,
        running_agents: 3,
        total_dispatched: 42,
    })
}

#[tauri::command]
pub async fn read_workflow_file(path: String) -> Result<String, String> {
    std::fs::read_to_string(&path).map_err(|e| e.to_string())
}

#[tauri::command]
pub async fn write_workflow_file(path: String, content: String) -> Result<(), String> {
    std::fs::write(&path, content).map_err(|e| e.to_string())
}
```

### `src-tauri/src/lib.rs`

```rust
mod commands;

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_shell::init())
        .plugin(tauri_plugin_fs::init())
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_process::init())
        .invoke_handler(tauri::generate_handler![
            commands::orchestrator::start_orchestrator,
            commands::orchestrator::stop_orchestrator,
            commands::orchestrator::get_orchestrator_status,
            commands::orchestrator::read_workflow_file,
            commands::orchestrator::write_workflow_file,
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
```

---

## 4. React 前端（关键 Hook）

### `useSymphonyCore.ts`（与 Tauri 通信）

```typescript
// apps/desktop/src/hooks/useSymphonyCore.ts

import { invoke } from '@tauri-apps/api/core';
import { useQuery, useMutation } from '@tanstack/react-query';

export function useOrchestratorStatus() {
  return useQuery({
    queryKey: ['orchestrator', 'status'],
    queryFn: () => invoke<OrchestratorStatus>('get_orchestrator_status'),
    refetchInterval: 5000, // 5s 轮询（也通过 Realtime 实时更新）
  });
}

export function useStartOrchestrator() {
  return useMutation({
    mutationFn: () => invoke('start_orchestrator'),
  });
}

export function useStopOrchestrator() {
  return useMutation({
    mutationFn: () => invoke('stop_orchestrator'),
  });
}
```

### `useRealtimeIssues.ts`（Supabase Realtime）

```typescript
// apps/desktop/src/hooks/useRealtimeIssues.ts

import { useEffect, useState } from 'react';
import { createSupabaseClient } from '@symphony/db';
import type { Issue } from '@symphony/db';

export function useRealtimeIssues() {
  const [issues, setIssues] = useState<Issue[]>([]);

  useEffect(() => {
    const supabase = createSupabaseClient();
    
    // 初始加载
    supabase.from('issues').select('*').then(({ data }) => {
      if (data) setIssues(data);
    });
    
    // 实时订阅
    const channel = supabase
      .channel('issues-changes')
      .on<Issue>(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'issues' },
        (payload) => {
          setIssues((prev) => {
            if (payload.eventType === 'INSERT') {
              return [...prev, payload.new];
            }
            if (payload.eventType === 'UPDATE') {
              return prev.map((i) => (i.id === payload.new.id ? payload.new : i));
            }
            if (payload.eventType === 'DELETE') {
              return prev.filter((i) => i.id !== payload.old.id);
            }
            return prev;
          });
        }
      )
      .subscribe();
    
    return () => { supabase.removeChannel(channel); };
  }, []);

  return issues;
}
```

---

## 5. 核心页面结构

### Dashboard（`routes/index.tsx`）

```typescript
// apps/desktop/src/routes/index.tsx

import { createFileRoute } from '@tanstack/react-router';
import { useRealtimeIssues } from '../hooks/useRealtimeIssues';
import { useOrchestratorStatus } from '../hooks/useSymphonyCore';
import { IssueCard, MetricsBar, StatusBadge } from '@symphony/ui';

export const Route = createFileRoute('/')({
  component: DashboardPage,
});

function DashboardPage() {
  const issues = useRealtimeIssues();
  const { data: status } = useOrchestratorStatus();

  const runningIssues = issues.filter((i) => i.runStatus === 'running');
  const failedIssues = issues.filter((i) => i.runStatus === 'failed');

  return (
    <div className="flex flex-col h-full p-6 gap-6">
      <MetricsBar
        isRunning={status?.is_running ?? false}
        runningAgents={status?.running_agents ?? 0}
        totalDispatched={status?.total_dispatched ?? 0}
      />
      
      <section>
        <h2 className="text-sm font-medium text-muted-foreground mb-3">
          Running ({runningIssues.length})
        </h2>
        <div className="grid gap-3">
          {runningIssues.map((issue) => (
            <IssueCard key={issue.id} issue={issue} />
          ))}
        </div>
      </section>
    </div>
  );
}
```

---

## 6. Orchestrator 与 Tauri 的集成方式

**方案：Node.js Sidecar**

Orchestrator（packages/core）作为 Tauri sidecar 进程运行，Tauri Rust 层负责：
- 启动/停止 sidecar 进程
- 读写文件系统（WORKFLOW.md、workspace 目录）
- 系统托盘图标

React 前端通过两个通道获取数据：
1. **Supabase Realtime**：实时状态变更（Issue 状态、Agent 进度）
2. **Tauri IPC（invoke）**：命令操作（启动/停止 Orchestrator、读写配置）

```
React UI
  ├─ Supabase Realtime ←─── Orchestrator (Node.js sidecar)
  └─ Tauri IPC ─────────▶ Rust commands ─▶ Node.js sidecar
```

---

## 7. 系统托盘配置

```rust
// 在 lib.rs 中添加系统托盘
use tauri::menu::{Menu, MenuItem};
use tauri::tray::TrayIconBuilder;

fn setup_tray(app: &tauri::AppHandle) -> tauri::Result<()> {
    let quit_i = MenuItem::with_id(app, "quit", "Quit Symphony", true, None::<&str>)?;
    let show_i = MenuItem::with_id(app, "show", "Open Symphony", true, None::<&str>)?;
    let menu = Menu::with_items(app, &[&show_i, &quit_i])?;
    
    TrayIconBuilder::new()
        .menu(&menu)
        .show_menu_on_left_click(false)
        .on_menu_event(|app, event| match event.id.as_ref() {
            "quit" => app.exit(0),
            "show" => {
                if let Some(window) = app.get_webview_window("main") {
                    let _ = window.show();
                    let _ = window.set_focus();
                }
            }
            _ => {}
        })
        .build(app)?;
    
    Ok(())
}
```

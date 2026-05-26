import { useEffect, useState } from 'react';
import { createRoute } from '@tanstack/react-router';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { getLlmConfig, setLlmConfig } from '@/lib/llm';
import { Route as AppRoute } from '../_app';

export const Route = createRoute({
  getParentRoute: () => AppRoute,
  path: '/settings',
  component: SettingsPage,
});

function SettingsPage() {
  const [apiKey, setApiKey] = useState('');
  const [baseUrl, setBaseUrl] = useState('https://api.minimax.io/v1');
  const [model, setModel] = useState('abab6.5s-chat');
  const [hasKey, setHasKey] = useState(false);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    getLlmConfig()
      .then((cfg) => {
        setBaseUrl(cfg.baseUrl);
        setModel(cfg.model);
        setHasKey(cfg.hasApiKey);
      })
      .catch(console.error);
  }, []);

  const handleSave = async () => {
    if (!apiKey && !hasKey) {
      toast.error('请输入 API Key');
      return;
    }
    setSaving(true);
    try {
      await setLlmConfig(apiKey || '', baseUrl, model);
      setHasKey(true);
      setApiKey('');
      toast.success('LLM 配置已保存');
    } catch (err) {
      console.error(err);
      toast.error('保存失败');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="max-w-lg mx-auto py-10 px-6 space-y-8">
      <div>
        <h2 className="text-base font-semibold">Settings</h2>
        <p className="text-xs text-muted-foreground mt-0.5">配置 LLM 服务以启用 AI 功能</p>
      </div>

      <section className="space-y-4">
        <h3 className="text-xs font-medium uppercase tracking-widest text-muted-foreground">LLM Provider</h3>

        <div className="space-y-1">
          <label className="text-xs font-medium">API Key</label>
          <input
            type="password"
            placeholder={hasKey ? '已设置（留空则不修改）' : '输入 API Key…'}
            value={apiKey}
            onChange={(e) => setApiKey(e.target.value)}
            className="w-full h-8 rounded-md border border-border bg-background px-3 text-xs focus:outline-none focus:ring-1 focus:ring-ring"
          />
          {hasKey && (
            <p className="text-[11px] text-emerald-400">✓ API Key 已配置</p>
          )}
        </div>

        <div className="space-y-1">
          <label className="text-xs font-medium">Base URL</label>
          <input
            type="text"
            value={baseUrl}
            onChange={(e) => setBaseUrl(e.target.value)}
            className="w-full h-8 rounded-md border border-border bg-background px-3 text-xs focus:outline-none focus:ring-1 focus:ring-ring"
          />
          <p className="text-[11px] text-muted-foreground">任何 OpenAI 兼容接口均可，例如 MiniMax、OpenAI、Claude proxy 等</p>
        </div>

        <div className="space-y-1">
          <label className="text-xs font-medium">Model</label>
          <input
            type="text"
            value={model}
            onChange={(e) => setModel(e.target.value)}
            className="w-full h-8 rounded-md border border-border bg-background px-3 text-xs focus:outline-none focus:ring-1 focus:ring-ring"
          />
        </div>

        <Button size="sm" onClick={() => void handleSave()} disabled={saving}>
          {saving ? '保存中…' : '保存配置'}
        </Button>
      </section>

      <section className="space-y-2 border-t border-border pt-6">
        <h3 className="text-xs font-medium uppercase tracking-widest text-muted-foreground">常用配置参考</h3>
        <div className="space-y-2 text-[11px] text-muted-foreground">
          <div className="rounded-md border border-border px-3 py-2 space-y-0.5">
            <p className="font-medium text-foreground">MiniMax（默认）</p>
            <p>Base URL: <code>https://api.minimax.io/v1</code></p>
            <p>Model: <code>abab6.5s-chat</code> 或 <code>abab6.5-chat</code></p>
          </div>
          <div className="rounded-md border border-border px-3 py-2 space-y-0.5">
            <p className="font-medium text-foreground">OpenAI</p>
            <p>Base URL: <code>https://api.openai.com/v1</code></p>
            <p>Model: <code>gpt-4o</code> 或 <code>gpt-4o-mini</code></p>
          </div>
          <div className="rounded-md border border-border px-3 py-2 space-y-0.5">
            <p className="font-medium text-foreground">Claude（via proxy）</p>
            <p>Base URL: 填写你的 OpenAI 兼容 proxy 地址</p>
            <p>Model: <code>claude-sonnet-4-5</code> 等</p>
          </div>
        </div>
      </section>
    </div>
  );
}

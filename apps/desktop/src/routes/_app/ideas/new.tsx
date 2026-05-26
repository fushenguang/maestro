import { useCallback, useRef, useState } from 'react';
import { createRoute, useNavigate } from '@tanstack/react-router';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { db } from '@/lib/db';
import { useAuthStore } from '@/store/auth';
import { Route as AppRoute } from '../../_app';

// ── Route ────────────────────────────────────────────────────────────────────

export const Route = createRoute({
  getParentRoute: () => AppRoute,
  path: '/ideas/new',
  component: NewIdeaPage,
});

// ── Types ─────────────────────────────────────────────────────────────────────

type SourceType = 'text' | 'url' | 'github' | 'doc' | 'feedback';

const SOURCE_CHIPS: { id: SourceType; label: string }[] = [
  { id: 'text', label: '⚡ raw idea' },
  { id: 'url', label: '⌁ url / article' },
  { id: 'github', label: '○ github repo' },
  { id: 'doc', label: '☰ prd / doc' },
  { id: 'feedback', label: '✉ user feedback' },
];

// ── GitHub repo detection ─────────────────────────────────────────────────────

const GITHUB_REGEX = /github\.com\/([^/]+)\/([^/?\s]+)/;

interface GitHubMeta {
  owner: string;
  repo: string;
  stars?: number;
  description?: string;
}

async function fetchGitHubMeta(url: string): Promise<GitHubMeta | null> {
  const match = url.match(GITHUB_REGEX);
  if (!match) return null;
  const [, owner, repo] = match;
  try {
    // Unauthenticated: 60 req/hr. TODO: thread a GitHub token from Settings for 5000/hr.
    const res = await fetch(`https://api.github.com/repos/${owner}/${repo}`);
    if (!res.ok) return { owner, repo };
    const data = (await res.json()) as { stargazers_count: number; description: string | null };
    return { owner, repo, stars: data.stargazers_count, description: data.description ?? undefined };
  } catch {
    return { owner, repo };
  }
}

// ── Component ─────────────────────────────────────────────────────────────────

function NewIdeaPage() {
  const navigate = useNavigate();
  const { user } = useAuthStore();
  const [sourceType, setSourceType] = useState<SourceType>('text');
  const [rawIdea, setRawIdea] = useState('');
  const [urlValue, setUrlValue] = useState('');
  const [githubMeta, setGithubMeta] = useState<GitHubMeta | null>(null);
  const [githubRepo, setGithubRepo] = useState('');
  const [dragging, setDragging] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const urlDebounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // ── URL input with debounced GitHub detection ─────────────────────────────

  const handleUrlChange = useCallback((val: string) => {
    setUrlValue(val);
    setGithubMeta(null);
    if (urlDebounceRef.current) clearTimeout(urlDebounceRef.current);
    urlDebounceRef.current = setTimeout(async () => {
      if (GITHUB_REGEX.test(val)) {
        setSourceType('github');
        const meta = await fetchGitHubMeta(val);
        setGithubMeta(meta);
      } else if (val.startsWith('http')) {
        setSourceType('url');
      }
    }, 400);
  }, []);

  // ── File drop zone ────────────────────────────────────────────────────────

  const handleFile = useCallback((file: File) => {
    const supported = ['.md', '.txt', '.pdf'];
    const ext = file.name.substring(file.name.lastIndexOf('.')).toLowerCase();
    if (!supported.includes(ext)) {
      setError(`Unsupported file type: ${ext}. Supported: .md, .txt, .pdf`);
      return;
    }
    const reader = new FileReader();
    reader.onload = (e) => {
      const content = e.target?.result as string;
      setRawIdea(content.slice(0, 8000)); // truncate for MVP
      setSourceType('doc');
    };
    reader.readAsText(file);
  }, []);

  const handleDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      setDragging(false);
      const file = e.dataTransfer.files[0];
      if (file) handleFile(file);
    },
    [handleFile],
  );

  // ── Submit ────────────────────────────────────────────────────────────────

  const handleSubmit = useCallback(async () => {
    if (!rawIdea.trim() || rawIdea.length < 20) return;
    if (!user?.id) {
      setError('Not authenticated. Please sign in.');
      return;
    }

    setSubmitting(true);
    setError(null);

    try {
      // Derive idea name from first line of raw idea (max 60 chars)
      const firstLine = rawIdea.split('\n')[0]?.trim() ?? '';
      const name = firstLine.length > 0 ? firstLine.slice(0, 60) : 'Untitled Idea';

      const idea = await db.ideas.create({
        userId: user.id,
        name,
        description: rawIdea.slice(0, 500),
      });

      // Set feed content fields via update
      await db.ideas.update(idea.id, {
        feedRawContent: rawIdea,
        feedSourceType: sourceType,
        feedSourceUrl: urlValue || null,
        githubRepo: githubRepo || null,
      });

      // Navigate to feed page where LLM analysis will run
      navigate({ to: '/ideas/$id/feed', params: { id: idea.id } });
    } catch (err) {
      setError(String(err));
      setSubmitting(false);
    }
  }, [rawIdea, user, sourceType, urlValue, githubRepo, navigate]);

  const canSubmit = rawIdea.trim().length >= 20 && !submitting;

  return (
    <div className="flex flex-col min-h-0 overflow-auto">
      {/* Page header */}
      <div className="flex items-center justify-between px-6 py-3 border-b border-border">
        <button
          onClick={() => navigate({ to: '/dashboard' })}
          className="font-mono text-xs text-muted-foreground hover:text-foreground transition-colors"
        >
          ← all products
        </button>
        <span className="font-mono text-sm font-semibold tracking-widest uppercase">
          New Idea
        </span>
        <div className="w-24" />
      </div>

      {/* Two-column form */}
      <div className="flex flex-1 gap-0 min-h-0">
        {/* Left — Feed Input */}
        <div className="flex-1 px-8 py-8 flex flex-col gap-5 border-r border-border">
          <p className="font-mono text-[10px] tracking-widest uppercase text-muted-foreground">
            Feed Anything
          </p>

          {/* Main textarea */}
          <textarea
            value={rawIdea}
            onChange={(e) => setRawIdea(e.target.value)}
            placeholder="说说你的想法... 或者粘贴一个 URL、描述一个你看到的开源项目、直接扔一个痛点"
            className="w-full min-h-[120px] resize-none rounded-md border border-border bg-background px-3 py-2.5 font-sans text-sm placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-ring"
          />

          {/* Source chips */}
          <div className="flex flex-wrap gap-2">
            {SOURCE_CHIPS.map((chip) => (
              <button
                key={chip.id}
                onClick={() => setSourceType(chip.id)}
                className={cn(
                  'px-3 py-1 rounded-full border font-mono text-[11px] transition-colors',
                  sourceType === chip.id
                    ? 'border-foreground bg-foreground text-background'
                    : 'border-border text-muted-foreground hover:border-foreground/50 hover:text-foreground',
                )}
              >
                {chip.label}
              </button>
            ))}
          </div>

          {/* URL input */}
          <div className="flex gap-2">
            <Input
              value={urlValue}
              onChange={(e) => handleUrlChange(e.target.value)}
              placeholder="paste url or github"
              className="flex-1 font-mono text-sm"
            />
            <Button
              variant="outline"
              size="sm"
              onClick={() => urlValue && handleUrlChange(urlValue)}
              className="font-mono text-xs"
            >
              ⇄ fetch
            </Button>
          </div>

          {/* GitHub meta preview */}
          {githubMeta && (
            <div className="rounded border border-border bg-muted/30 px-3 py-2 font-mono text-xs text-muted-foreground">
              <span className="text-foreground font-medium">
                {githubMeta.owner}/{githubMeta.repo}
              </span>
              {githubMeta.stars !== undefined && (
                <span className="ml-2">★ {githubMeta.stars.toLocaleString()}</span>
              )}
              {githubMeta.description && (
                <p className="mt-1 text-[10px] truncate">{githubMeta.description}</p>
              )}
            </div>
          )}

          {/* File drop zone */}
          <div
            onDrop={handleDrop}
            onDragOver={(e) => { e.preventDefault(); setDragging(true); }}
            onDragLeave={() => setDragging(false)}
            onClick={() => fileInputRef.current?.click()}
            className={cn(
              'flex items-center justify-center rounded border-2 border-dashed py-4 cursor-pointer transition-colors font-mono text-xs text-muted-foreground',
              dragging ? 'border-foreground bg-accent/20' : 'border-border hover:border-foreground/40',
            )}
          >
            ↑ drop prd / markdown / pdf here
          </div>
          <input
            ref={fileInputRef}
            type="file"
            accept=".md,.txt,.pdf"
            className="hidden"
            onChange={(e) => { const f = e.target.files?.[0]; if (f) handleFile(f); }}
          />

          {/* GitHub repo link */}
          <div>
            <p className="font-mono text-[10px] tracking-widest uppercase text-muted-foreground mb-1.5">
              Link GitHub Repo
            </p>
            <div className="flex gap-2">
              <Input
                value={githubRepo}
                onChange={(e) => setGithubRepo(e.target.value)}
                placeholder="yourteam/repo-name"
                className="flex-1 font-mono text-sm"
              />
              <Button variant="outline" size="sm" className="font-mono text-xs">
                ⊙ connect
              </Button>
            </div>
          </div>
        </div>

        {/* Right — Submit panel */}
        <div className="w-[380px] shrink-0 px-8 py-8 flex flex-col gap-5">
          <p className="font-mono text-[10px] tracking-widest uppercase text-muted-foreground">
            Ready to Analyze
          </p>

          <div className="rounded border border-border bg-muted/20 px-4 py-3 font-mono text-xs text-muted-foreground leading-5">
            ⊙ &nbsp;Opus 4 将读取你的想法，生成 intent canvas，启动多轮澄清对话。
          </div>

          {rawIdea.length > 0 && rawIdea.length < 20 && (
            <p className="font-mono text-[11px] text-amber-500">
              Please add a bit more context (at least 20 chars)
            </p>
          )}

          {error && (
            <p className="font-mono text-[11px] text-destructive">{error}</p>
          )}

          <div className="mt-auto flex flex-col gap-3 pt-4">
            <div className="flex items-center gap-3">
              <Button
                variant="outline"
                className="flex-1 font-mono text-sm"
                onClick={() => navigate({ to: '/dashboard' })}
                disabled={submitting}
              >
                cancel
              </Button>
              <Button
                className="flex-1 font-sans text-sm font-semibold"
                onClick={() => void handleSubmit()}
                disabled={!canSubmit}
              >
                {submitting ? 'creating…' : '✦ register idea & start research ↗'}
              </Button>
            </div>
            <p className="font-mono text-[10px] text-muted-foreground/60 text-center">
              ⊗ deadline 和 success metric 提交后不可修改。需要延期需发布一篇公开文章。
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}

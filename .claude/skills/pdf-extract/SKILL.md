---
name: pdf-extract
description: |
  把 PDF 文件转成结构化 markdown，输出与 research-source cache 格式对齐（按行可锚点）。
  覆盖：单栏 / 双栏 / 多栏 / 扫描 OCR / 大文件分块。
  在用户提到「处理 PDF」「读 PDF」「PDF 抽文本」「PDF 转 markdown」「academic paper 抽取」时使用。
  不做 PDF 编辑 / 表单 / 合并（用 Anthropic 官方 pdf skill）。
---

# pdf-extract Skill（v0.2，2026-06-11 晚）

> 把 PDF 抽到 markdown，**唯一目标**：输出能被 research-source skill 当 cache 读、有锚点可反查。

## 定位

| 场景 | 用什么 |
|---|---|
| **抽 PDF 文本/表格 → markdown**（research 流水线） | **本 skill（pdf-extract）** |
| PDF 编辑 / 合并 / 拆分 / 表单填写 | Anthropic 官方 pdf skill（`LobsterAI/SKILLs/pdf/`） |
| 读图片 / OCR 通用场景 | 直接用 `pytesseract` / `pdf2image` |

## 参数

```
python3 scripts/extract.py --input {pdf} --output {cache_dir}/{slug}.md [--mode auto|simple|layout|ocr]
```

| 参数 | 必填 | 默认 | 说明 |
|---|---|---|---|
| `--input` | 是 | — | PDF 文件路径 |
| `--output` | 是 | — | 输出 markdown 路径（cache 内） |
| `--mode` | 否 | `auto` | 见下「4 种模式」 |
| `--max-bytes` | 否 | 80000 | 单文件字节上限；超过按页拆分 |
| `--ocr-lang` | 否 | `eng` | OCR 模式语言（`eng` / `chi_sim` / `eng+chi_sim`） |
| `--x-tolerance` | 否 | `1` | simple 模式 x_tolerance（pdfplumber **反直觉**：值大=更激进合并为同一 word；学术 PDF 建议 1） |

## 4 种模式

| 模式 | 工具 | 何时用 | 速度 |
|---|---|---|---|
| `simple` | pdfplumber | 单栏 / 短文 / Letter | 快（~1s/页） |
| `layout` | pypdfium2 + 自写 layout_parser | **双栏 / 多栏学术论文** | 中（~2s/页） |
| `ocr` | pytesseract | 扫描版 PDF | 慢（~10s/页） |
| `auto` | layout + quality_check | **默认** | 中 + 必要时 fallback |

`auto` 流程：
1. 先用 `layout` 模式跑一次
2. 调 `quality_check.py` 打分（0-1）
3. < 0.6 → 自动 fallback 到 `ocr`
4. ≥ 0.6 → 输出 layout 结果

## 输出格式（**与 research-source cache 对齐**）

```markdown
# {pdf_filename} 提取自 PDF
<!-- pages: 12, mode: layout, extracted_at: 2026-06-11 -->
<!-- page 1 -->
# Title of the Paper

## Authors

Author1, Author2

## Abstract

This paper...

<!-- page 2 -->
## 1. Introduction

The field of...

## 2. Related Work

(p5:L23) Smith et al. (2020) showed that...
```

- 每页 `<!-- page N -->` 标记
- 锚点 `(p{n}:L{n})` = 第 n 页第 n 行
- 同行多锚点用 `(p5:L23)(p5:L45)`
- 跨页锚点 = `<!-- page N -->` 上面那行

## 大文件分块（**P32**）

- 默认 `max_bytes=80000`（≈ 80KB）
- 单文件超出 → 自动按页拆到 `{output_dir}/{slug}-p{N}.md`
- 同时生成 `{output_dir}/{slug}-index.md` 索引页（含每页字节数 + 起始锚点）
- 拆分不破坏锚点（保留页号）

## 与 research-source 集成（**v0.4+ 兼容**）

- research-source Step 1 加 PDF 分支：「URL 以 `.pdf` 结尾 **或** Content-Type 是 `application/pdf` → 走 pdf-extract」
- 输出落 `cache_dir/raw-fetches/batch{N}/{slug}.md`
- subagent 走 cache-first（沿用 research-source 硬约束 #12）
- 锚点格式 `(p5:L23)` 直接被 research-source cross-check 接受

## 硬约束（**v0.2**）

1. **P31 库选择**：仅用 pdfplumber (MIT) + pypdfium2 (Apache) + pytesseract (Apache)。**禁用** pymupdf (AGPL 风险) / nougat / marker（首次装 2GB+ 模型，批 4 预算冲突）
2. **P32 大 PDF 分块**：> 80KB 自动按页拆 + 子文件命名 `{slug}-p{N}.md` + `-index.md` 索引
3. **P33 扫描 PDF 显式 opt-in**：OCR 模式必须 `--mode ocr`；`auto` 模式 fallback 用 OCR 但**不默认启用**
4. **P37 x_tolerance 反直觉**（v0.2 加 CLI 参数）：pdfplumber 的 `x_tolerance` 值**大=更激进合并**为同一 word。**默认 1** 适配西文学术 PDF；CJK / 紧排版可能需要不同值（参考 `reference.md` 「pdfplumber 反直觉行为」段）

## 已知坑

- **双栏误判**：banner/header/footer 跨栏会被误当栏内容；用 `y > top_margin` 过滤
- **图表引用断裂**：图说（caption）通常与图分离，layout 模式可能把 caption 放到下页
- **公式乱码**：LaTeX 公式 PDF 抽出来是符号序列，需要 v0.2+ 集成 `nougat` 或 `pix2tex`
- **扫描 PDF 检测**：通过 `pdfplumber.Page.chars` 为空 + 图片数量 > 0 判定

## 失败处理

| 失败 | 处理 |
|---|---|
| PDF 文件不存在 | 报错 + exit 2 |
| PDF 加密 / 受保护 | 报错 + 提示用户解密 |
| OCR 模式无 tesseract 二进制 | 报错 + 提示 `brew install tesseract` |
| 输出目录不存在 | 自动创建 |
| quality_check 始终 < 0.6（auto fallback OCR 也差） | 输出 layout + ocr 两个版本 + 标 `quality_warning: true` |

## 文件

- `scripts/extract.py` — 主入口（CLI）
- `scripts/layout_parser.py` — 双栏 / 多栏检测 + 按栏重组
- `scripts/quality_check.py` — 输出自评（OCR 字符 / 锚点密度 / 乱码率）
- `reference.md` — 工具备选 / 字体 / 扫描 PDF 排查
- `config.example.json` — 默认配置

## 变更日志

- **v0.2（2026-06-11 晚）**：修 P34-P37
  - P34：layout_parser 改「行 x 坐标众数法」+ 多 gap 支持
  - P35：layout_parser 接收 image_bboxes 过滤图区域 word
  - P36：quality_check 加 column_coverage + chart_text_ratio 2 维；auto 阈值 0.6 → 0.75
  - P37：x_tolerance 暴露为 CLI 参数 + 文档化反直觉行为
- **v0.1（2026-06-11）**：初版，3 模式 + auto fallback + 大文件分块

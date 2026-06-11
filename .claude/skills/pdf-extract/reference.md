# pdf-extract Reference（v0.2）

补充 SKILL.md 没说清的：备选工具、字体坑、扫描 PDF 排查、调优参数、pdfplumber 反直觉行为。

补充 SKILL.md 没说清的：备选工具、字体坑、扫描 PDF 排查、调优参数。

## 备选工具（v0.1 不用，v0.2 候选）

| 工具 | 优势 | 劣势 | 何时考虑升级 |
|---|---|---|---|
| **pymupdf (fitz)** | 比 pypdfium2 快 2-3x，渲染好 | AGPL（传染），商业风险 | 只在自己项目 + 不分发 |
| **nougat-ocr** | Meta 学术 PDF 专用，公式 → LaTeX | 首次装 2GB 模型，CPU 慢 | 学术论文占比 > 50% |
| **marker-pdf** | Datalab 出，PDF → markdown 比 nougat 快 | 模型 1.5GB，质量比 nougat 略差 | 想要 GPU 加速 + 接受质量 trade-off |
| **unstructured** | 多格式统一 API（PDF/DOCX/HTML） | 体积大，复杂依赖 | 未来要扩 DOCX/PPTX 时 |
| **pypdf** | 纯 Python，零依赖 | 不保留布局 | 紧急情况 / 无 pypdfium2 时 |

**v0.1 选择 pdfplumber + pypdfium2 的理由**：
- 两者都已装在 anaconda3 环境
- 组合覆盖 80%+ 学术 PDF（双栏 / 表格 / 简单公式）
- 零额外安装成本

## 字体坑

### CJK 字体（中日韩）
- pdfplumber 默认 CMap 路径可能找不到 → 装 `pdfminer.six` 自带 CMap（已装）
- macOS 自带 CJK 字体不导出到 PDF，但 PDF **嵌入** CJK 字体可抽
- 输出 markdown 后，CJK 字符应保留为 Unicode（**不要**转义）

### 数学公式（LaTeX）
- 嵌入字体 PDF：`x_1 + x_2 = y` 抽出来是 `x1 + x2 = y`（下标丢失）
- 矢量公式 PDF：完全乱码（变成 `î` 之类）
- **临时方案**：v0.1 接受乱码，标 `formula_quality: poor`
- **长期方案**：v0.2 集成 `pix2tex`（公式识别） 或 `nougat-ocr`

### 表格
- pdfplumber `extract_tables()` 输出 2D list
- v0.1 用 `|` 拼成 markdown 表格（**不完美**但可读）
- v0.2 考虑用 `camelot-py` 或 `tabula-py`（Java 依赖）

## 扫描 PDF 排查

**判定信号**：
```python
import pdfplumber
with pdfplumber.open("scan.pdf") as pdf:
    for i, page in enumerate(pdf.pages):
        chars = page.chars
        images = page.images
        if not chars and images:
            print(f"Page {i+1}: 扫描版（chars={len(chars)}, images={len(images)}）")
```

**修复路径**：
1. 用户原文档如果不是扫描的（能选中文本）→ 重新导出 PDF
2. 确实是扫描的 → 用 `--mode ocr`
3. tesseract 未装：`brew install tesseract tesseract-lang`
4. macOS Apple Silicon 注意：`tesseract` binary 在 `/opt/homebrew/bin/`

## 调优参数

### pdfplumber
| 参数 | 默认 | 调优场景 |
|---|---|---|
| `x_tolerance` | 3 | **反直觉**：值大 = 字符间允许距离大 = **更激进合并**为同一 word。学术 PDF 建议 1；CJK 字符可能需要 0 |
| `y_tolerance` | 3 | 表格行间距大 → 调到 5；宽行距双栏 → 调到 8 |
| `keep_blank_chars` | False | 想保留空白做版面分析 → True |

### pdfplumber 反直觉行为详解（**P37 沉淀**）

pdfplumber 文档说「x_tolerance is the tolerance for grouping characters into words」——读起来值小=严格=不合并。**实际相反**：

- 值大 = 字符间允许距离更大 = **更激进合并**为同一 word
- 值小 = 字符间允许距离更小 = **更激进分词**

**实测**（constitutional-ai-paper.pdf）：
| `x_tolerance` | 实际效果 |
|---|---|
| **1**（默认） | "Yuntao Bai∗, Saurav Kadavath"（正确）|
| 3（pdfplumber 默认）| "YuntaoBai∗, SauravKadavath"（合并）|
| 5 | "YuntaoBai∗,SauravKadavath"（更合并，连逗号后空格都吞）|
| 10 | "YuntaoBai∗,SauravKadavath,SandipanKundu,..."（激进合并）|

**调优建议**：
- **西文学术 PDF / Letter**：`x_tolerance=1`
- **CJK（中文 / 日文 / 韩文）**：保持 `x_tolerance=0`（避免合并相邻汉字）
- **等宽字体（typewriter）**：`x_tolerance=2`（字符等距，单词间空格也等距，需要严格点）
- **公式 / 表格**：不需要调，layout_parser 处理

### pypdfium2
| 参数 | 默认 | 调优场景 |
|---|---|---|
| `scale` | 1.0 | 想要高清渲染（OCR 前） → 2.0 |
| `rotation` | 0 | 旋转的扫描件 → 90/180/270 |

### pytesseract
| 参数 | 默认 | 调优场景 |
|---|---|---|
| `lang` | `eng` | 中文 → `chi_sim` |
| `config` | `--oem 1 --psm 3` | 单栏 `--psm 4` / 单字符 `--psm 10` |
| `dpi` | 300 | 缩放后图像可降 |

## 已知 PDF 行为差异

### 学术论文（arXiv 风格）
- 几乎都是 2 栏，**layout 模式最优**
- 公式多用 LaTeX 嵌入字体 → 抽出来符号 OK
- 引用列表（References）单栏 → 切到 simple 模式更准
- **建议**：先用 `layout` 全文，References 段切到 `simple` 重抽

### 商业报告（10-K / 10-Q / Letter）
- 多栏 + 表格 + 图，**layout 模式**好
- 表格复杂（合并单元格）→ pdfplumber 表格提取会丢结构
- **建议**：用 `extract_tables()` 输出 CSV + markdown 双格式

### 扫描书籍（无 OCR）
- 全文图片，**只能 OCR**
- 字体小 / 模糊 → OCR 准确率 < 50%
- **建议**：尝试 `tesseract --psm 6`（假设单列块）

## 性能基线（v0.1 实测 2026-06-11）

| PDF 类型 | 模式 | 速度 | 输出质量 |
|---|---|---|---|
| `constitutional-ai-paper.pdf` (2MB, 60 页) | simple | ~5s | 中（2 栏乱序） |
| 同上 | layout | ~12s | 高（按逻辑段） |
| 同上 | auto | ~15s（含 quality_check） | 高 |
| `Amazon-com-Inc-2023-Shareholder-Letter.pdf` (101KB, 12 页) | simple | ~1s | 高 |
| 扫描版（无样本，待测） | ocr | ~10s/页 | 取决于扫描质量 |

## 升级路径（v0.2 → v1.0）

| 版本 | 计划 |
|---|---|
| **v0.2** | 集成 `nougat-ocr`（可选，`--mode nougat`）；表格用 `camelot-py` |
| **v0.3** | 公式识别 `pix2tex`；自动检测单/双栏 + References 段切回 simple |
| **v1.0** | 上 ML-based 通用方案，pypdfium2 退化为 fallback |

## 相关资源

- pdfplumber: https://github.com/jsvine/pdfplumber
- pypdfium2: https://github.com/pypdfium2-team/pypdfium2
- pytesseract: https://github.com/madmaze/pytesseract
- nougat: https://github.com/facebookresearch/nougat
- marker: https://github.com/datalab-to/marker

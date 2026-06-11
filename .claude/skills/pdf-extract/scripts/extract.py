#!/usr/bin/env python3
"""
pdf-extract skill 主入口
PDF → markdown，4 模式：auto / simple / layout / ocr
输出格式与 research-source cache 对齐（按行可锚点 + 页标记）
"""

import argparse
import json
import os
import re
import sys
from datetime import datetime
from pathlib import Path

# 本地脚本
sys.path.insert(0, str(Path(__file__).parent))
import layout_parser
import quality_check


# ---------- 模式实现 ----------

def extract_simple(pdf_path: str) -> list[dict]:
    """simple 模式：pdfplumber 逐页抽文本，无布局处理。
    Returns: [{page_num, text, anchors_per_line}]
    """
    import pdfplumber

    pages = []
    with pdfplumber.open(pdf_path) as pdf:
        for i, page in enumerate(pdf.pages, 1):
            # x_tolerance=1 修单词内空格丢失（默认 3 会合并"Yuntao Bai"为"YuntaoBai"）
            # y_tolerance=3 容忍表格行间距
            # v0.1 已知：x_tolerance 小可能切碎连字（CJK 字符），西文学术 PDF OK
            text = page.extract_text(x_tolerance=1, y_tolerance=3) or ""
            lines = text.split("\n")
            pages.append({
                "page_num": i,
                "text": text,
                "lines": lines,
            })
    return pages


def extract_layout(pdf_path: str) -> list[dict]:
    """layout 模式：pdfplumber 提 words + layout_parser 按栏重组。
    相比字符级 bbox，word-level 更稳健（保留单词空格 + 行高聚类准）。
    Returns: [{page_num, text, lines, columns_detected}]
    """
    import pdfplumber

    pages = []
    with pdfplumber.open(pdf_path) as pdf:
        for i, page in enumerate(pdf.pages, 1):
            # 提 words：每个 word 含 bbox
            words = page.extract_words(x_tolerance=5, y_tolerance=3,
                                       keep_blank_chars=False)
            # 转成 layout_parser 期望的格式
            word_dicts = [
                {
                    "text": w["text"],
                    "bbox": (w["x0"], w["top"], w["x1"], w["bottom"]),
                }
                for w in words
            ]
            # 解析 → 按栏重组
            result = layout_parser.parse_columns_from_words(
                word_dicts, page.width, page.height
            )
            pages.append({
                "page_num": i + 1,
                "text": result["text"],
                "lines": result["text"].split("\n"),
                "columns_detected": result.get("columns", 1),
            })
    return pages


def extract_ocr(pdf_path: str, lang: str = "eng") -> list[dict]:
    """ocr 模式：pytesseract + pdf2image。
    慢（~10s/页），显式 opt-in。
    """
    try:
        from pdf2image import convert_from_path
        import pytesseract
    except ImportError:
        print(
            "ERROR: ocr 模式需要 pdf2image + pytesseract。\n"
            "安装: pip install pdf2image pytesseract\n"
            "macOS: brew install tesseract tesseract-lang",
            file=sys.stderr,
        )
        sys.exit(3)

    images = convert_from_path(pdf_path, dpi=200)
    pages = []
    for i, image in enumerate(images, 1):
        text = pytesseract.image_to_string(image, lang=lang)
        pages.append({
            "page_num": i,
            "text": text,
            "lines": text.split("\n"),
        })
    return pages


# ---------- 输出格式 ----------

def format_output(pdf_path: str, pages: list[dict], mode: str,
                  quality_score: float | None = None) -> str:
    """组装最终 markdown：页头 + 页标记 + 行内锚点。

    输出结构：
      # {filename} 提取自 PDF
      <!-- pages: N, mode: X, extracted_at: YYYY-MM-DD, quality: 0.85 -->
      <!-- page 1 -->
      (p1:L1) line 1
      (p1:L2) line 2
      ...
      <!-- page 2 -->
      (p2:L1) line 1
    """
    pdf_name = os.path.basename(pdf_path)
    extracted_at = datetime.now().strftime("%Y-%m-%d %H:%M:%S")
    total_pages = len(pages)

    quality_str = f", quality: {quality_score:.2f}" if quality_score is not None else ""
    header = f"# {pdf_name} 提取自 PDF\n"
    meta = f"<!-- pages: {total_pages}, mode: {mode}, extracted_at: {extracted_at}{quality_str} -->\n"

    body_parts = [header, meta]
    for page in pages:
        body_parts.append(f"<!-- page {page['page_num']} -->\n")
        for line_num, line in enumerate(page["lines"], 1):
            # 锚点前缀，跨页继续累加 line_num
            anchor = f"(p{page['page_num']}:L{line_num})"
            # 空行也要保留（版面结构）
            body_parts.append(f"{anchor} {line}\n")
        body_parts.append("\n")  # 页间空行

    return "".join(body_parts)


def split_if_too_large(content: str, output_path: str, max_bytes: int,
                       slug: str) -> list[str]:
    """如果单文件超出 max_bytes，按页拆分 + 生成索引页。
    Returns: 实际写入的文件路径列表。
    """
    if len(content.encode("utf-8")) <= max_bytes:
        # 不超，单文件
        os.makedirs(os.path.dirname(output_path), exist_ok=True)
        with open(output_path, "w", encoding="utf-8") as f:
            f.write(content)
        return [output_path]

    # 超大：按页拆分
    output_dir = os.path.dirname(output_path)
    base = os.path.basename(output_path)
    name, ext = os.path.splitext(base)
    os.makedirs(output_dir, exist_ok=True)

    # 拆 header / 每页 / 索引
    parts = content.split("<!-- page ")
    header = parts[0]  # # filename + meta line
    page_chunks = ["<!-- page " + p for p in parts[1:]]

    written_files = []
    index_lines = [header, "\n## Index\n"]

    for chunk in page_chunks:
        # 第一行是 "<!-- page N -->\n"，提页号
        m = re.match(r"<!-- page (\d+) -->", chunk)
        if not m:
            continue
        page_num = m.group(1)
        chunk_path = os.path.join(output_dir, f"{name}-p{page_num}{ext}")
        with open(chunk_path, "w", encoding="utf-8") as f:
            f.write(header + chunk)
        written_files.append(chunk_path)
        chunk_bytes = len(chunk.encode("utf-8"))
        index_lines.append(f"- `{name}-p{page_num}{ext}` ({chunk_bytes} bytes)\n")

    # 索引页
    index_path = os.path.join(output_dir, f"{name}-index{ext}")
    with open(index_path, "w", encoding="utf-8") as f:
        f.writelines(index_lines)
    written_files.append(index_path)
    return written_files


# ---------- 主流程 ----------

def detect_scanned(pdf_path: str) -> bool:
    """快速检测：是否扫描版（chars=0 + images>0）。"""
    try:
        import pdfplumber
    except ImportError:
        return False
    with pdfplumber.open(pdf_path) as pdf:
        for page in pdf.pages[:3]:  # 只看前 3 页
            if not page.chars and page.images:
                return True
    return False


def run(pdf_path: str, output_path: str, mode: str, max_bytes: int,
        ocr_lang: str = "eng") -> dict:
    """主流程。Returns: {status, mode, quality_score, files, pages}"""
    if not os.path.exists(pdf_path):
        print(f"ERROR: PDF 不存在: {pdf_path}", file=sys.stderr)
        sys.exit(2)

    # 检测扫描版
    is_scanned = detect_scanned(pdf_path)
    if is_scanned and mode == "auto":
        print(f"  → 检测到扫描版 PDF（chars=0 + images>0），auto 模式直接走 ocr", file=sys.stderr)

    # 模式分发
    quality_score = None
    if mode == "auto":
        # 扫描版直接 OCR
        if is_scanned:
            print(f"[auto] 扫描版 → ocr", file=sys.stderr)
            pages = extract_ocr(pdf_path, lang=ocr_lang)
            actual_mode = "ocr"
            quality_score = 0.5  # OCR 默认 0.5
        else:
            print(f"[auto] 先 layout + quality_check", file=sys.stderr)
            pages = extract_layout(pdf_path)
            full_text = "\n".join(p["text"] for p in pages)
            quality_score = quality_check.score(full_text, pages)
            if quality_score < 0.6:
                print(f"[auto] quality={quality_score:.2f} < 0.6，fallback → ocr", file=sys.stderr)
                pages = extract_ocr(pdf_path, lang=ocr_lang)
                actual_mode = "ocr"
            else:
                actual_mode = "layout"
    elif mode == "simple":
        pages = extract_simple(pdf_path)
        actual_mode = "simple"
    elif mode == "layout":
        pages = extract_layout(pdf_path)
        actual_mode = "layout"
    elif mode == "ocr":
        pages = extract_ocr(pdf_path, lang=ocr_lang)
        actual_mode = "ocr"
        quality_score = 0.5
    else:
        print(f"ERROR: 未知 mode: {mode}", file=sys.stderr)
        sys.exit(2)

    # 格式化 + 落盘
    content = format_output(pdf_path, pages, actual_mode, quality_score)
    written = split_if_too_large(content, output_path, max_bytes,
                                  slug=os.path.splitext(os.path.basename(output_path))[0])

    return {
        "status": "ok",
        "mode": actual_mode,
        "quality_score": quality_score,
        "files": written,
        "pages": len(pages),
    }


def main():
    parser = argparse.ArgumentParser(
        description="pdf-extract: PDF → markdown（research-source cache 格式）"
    )
    parser.add_argument("--input", required=True, help="PDF 文件路径")
    parser.add_argument("--output", required=True, help="输出 markdown 路径")
    parser.add_argument("--mode", default="auto",
                        choices=["auto", "simple", "layout", "ocr"],
                        help="抽取模式（默认 auto）")
    parser.add_argument("--max-bytes", type=int, default=80000,
                        help="单文件字节上限（默认 80000）")
    parser.add_argument("--ocr-lang", default="eng", help="OCR 语言（默认 eng）")
    args = parser.parse_args()

    result = run(args.input, args.output, args.mode, args.max_bytes, args.ocr_lang)
    # 给主 Claude 一份机器可读 result（写到 output 同名 .json）
    result_path = args.output + ".result.json"
    with open(result_path, "w", encoding="utf-8") as f:
        json.dump(result, f, indent=2, ensure_ascii=False)

    print(f"✓ 抽取完成: mode={result['mode']}, pages={result['pages']}, "
          f"quality={result['quality_score']}, files={len(result['files'])}")
    print(f"✓ 产物: {result['files']}")


if __name__ == "__main__":
    main()

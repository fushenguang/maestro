"""
layout_parser: 双栏 / 多栏检测 + 按逻辑段落重组
输入：word-level 字典（含 text + bbox）
输出：按阅读顺序（先左栏后右栏）排列的文本
"""

from collections import defaultdict


def cluster_lines(words, y_tolerance: float = 3.0):
    """按 y 坐标聚类成行。
    words: [{"text": str, "bbox": (x0, y0, x1, y1)}, ...]
    Returns: [[word, ...], ...]  # 每行一组 words
    """
    if not words:
        return []

    # 按 y 中心点排序（更稳健：top + (bottom-top)/2）
    sorted_words = sorted(words, key=lambda w: (w["bbox"][1], w["bbox"][0]))
    lines = []
    current_line = [sorted_words[0]]
    current_y_center = (sorted_words[0]["bbox"][1] + sorted_words[0]["bbox"][3]) / 2

    for word in sorted_words[1:]:
        word_y_center = (word["bbox"][1] + word["bbox"][3]) / 2
        if abs(word_y_center - current_y_center) <= y_tolerance:
            current_line.append(word)
        else:
            lines.append(sorted(current_line, key=lambda w: w["bbox"][0]))
            current_line = [word]
            current_y_center = word_y_center
    lines.append(sorted(current_line, key=lambda w: w["bbox"][0]))
    return lines


def detect_columns(lines, page_width: float, min_gap_ratio: float = 0.15):
    """检测栏数。
    方法：统计每行最左 word 的 x 坐标分布，找大 gap。
    Returns: {"columns": int, "column_boundaries": [(x0, x1), ...]}
    """
    if not lines:
        return {"columns": 1, "column_boundaries": [(0, page_width)]}

    # 收集所有行最左 word 的 x0
    x_starts = []
    for line in lines:
        if not line:
            continue
        x_starts.append(round(line[0]["bbox"][0], 1))

    if len(x_starts) < 2:
        return {"columns": 1, "column_boundaries": [(0, page_width)]}

    # 找最大 gap（按 x 起点聚类）
    x_starts_sorted = sorted(set(x_starts))
    if len(x_starts_sorted) < 2:
        return {"columns": 1, "column_boundaries": [(0, page_width)]}

    gaps = [(x_starts_sorted[i + 1] - x_starts_sorted[i],
             x_starts_sorted[i], x_starts_sorted[i + 1])
            for i in range(len(x_starts_sorted) - 1)]
    gaps.sort(reverse=True)
    max_gap, gap_start, gap_end = gaps[0]

    if max_gap < page_width * min_gap_ratio:
        return {"columns": 1, "column_boundaries": [(0, page_width)]}

    return {
        "columns": 2,
        "column_boundaries": [(0, gap_start), (gap_end, page_width)],
    }


def assign_to_column(line, column_boundaries):
    """判断一行属于哪一栏（按最左 word 的 x0）。"""
    if not line:
        return 0
    x0 = line[0]["bbox"][0]
    for i, (cx0, cx1) in enumerate(column_boundaries):
        if cx0 <= x0 < cx1:
            return i
    return 0


def line_to_text(line) -> str:
    """一行 words → 文本（words 间加空格）。"""
    if not line:
        return ""
    parts = []
    for w in line:
        # word text 已含可能的小空格（如 "Smith,"），直接拼接即可
        parts.append(w["text"])
    return " ".join(parts)


def parse_columns_from_words(words: list[dict], page_width: float,
                             page_height: float, y_tolerance: float = 3.0,
                             min_gap_ratio: float = 0.15) -> dict:
    """主入口（word-level，比字符级稳健）。
    words: [{"text": str, "bbox": (x0, y0, x1, y1)}, ...]
    Returns: {"text": str, "lines": list, "columns": int}
    """
    if not words:
        return {"text": "", "lines": [], "columns": 1}

    # 1. 按行聚类
    lines = cluster_lines(words, y_tolerance=y_tolerance)

    # 2. 检测栏数
    col_info = detect_columns(lines, page_width, min_gap_ratio=min_gap_ratio)
    columns = col_info["columns"]
    column_boundaries = col_info["column_boundaries"]

    # 3. 按栏分组
    column_lines = [[] for _ in range(columns)]
    for line in lines:
        col_idx = assign_to_column(line, column_boundaries)
        column_lines[col_idx].append(line)

    # 4. 重组文本（左栏 top→bottom，右栏 top→bottom...）
    text_parts = []
    for col_idx, col_lines in enumerate(column_lines):
        if columns > 1 and col_lines:
            text_parts.append(f"\n=== Column {col_idx + 1} ===\n")
        for line in col_lines:
            text_parts.append(line_to_text(line) + "\n")

    text = "".join(text_parts)
    return {
        "text": text,
        "lines": text.split("\n"),
        "columns": columns,
    }


# ---------- 兼容旧 API（character-level，v0.1 备用） ----------

def parse_columns(bboxes, page_size: tuple, y_tolerance: float = 3.0,
                  min_gap_ratio: float = 0.15) -> dict:
    """旧入口（character-level bbox）。已弃用，保留以防回归。"""
    print("WARN: parse_columns（字符级）已弃用，请用 parse_columns_from_words",
          __import__("sys").stderr)
    return parse_columns_from_words(
        [{"text": b.get("char", ""), "bbox": b["bbox"]} for b in bboxes],
        page_size[0], page_size[1], y_tolerance, min_gap_ratio
    )


def parse_with_pdfplumber_chars(pdf_path: str, page_num: int) -> list[dict]:
    """用 pdfplumber 提单字符 bbox（备用 API）。"""
    import pdfplumber
    bboxes = []
    with pdfplumber.open(pdf_path) as pdf:
        page = pdf.pages[page_num - 1]
        for char in page.chars:
            bboxes.append({
                "text": char["text"],
                "bbox": (char["x0"], char["top"], char["x1"], char["bottom"]),
            })
    return bboxes


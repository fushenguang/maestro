"""
layout_parser v0.2: 双栏 / 多栏检测 + 按逻辑段落重组
v0.2 改进（P34 + P35 修复）：
- 接收 image_bboxes 参数，过滤图区域内的 word（修 P35）
- 用「行 x 坐标众数」替代「最左 x0」找栏（修 P34）
- 多 gap 检测支持三栏 / 异形栏
"""

from collections import Counter, defaultdict


def filter_words_in_images(words: list[dict], image_bboxes: list[tuple],
                           padding: float = 2.0) -> list[dict]:
    """过滤图区域内的 word（修 P35）。
    image_bboxes: [(x0, y0, x1, y1), ...]
    Returns: 过滤后的 words
    """
    if not image_bboxes:
        return words

    def in_any_image(w_bbox):
        wx0, wy0, wx1, wy1 = w_bbox
        for (ix0, iy0, ix1, iy1) in image_bboxes:
            # word 中心点在图 bbox 内（含 padding）即视为图内容
            cx = (wx0 + wx1) / 2
            cy = (wy0 + wy1) / 2
            if (ix0 - padding <= cx <= ix1 + padding and
                    iy0 - padding <= cy <= iy1 + padding):
                return True
        return False

    return [w for w in words if not in_any_image(w["bbox"])]


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


def detect_columns(lines, page_width: float, min_gap_ratio: float = 0.15,
                   min_lines_per_col: int = 3):
    """v0.2 改进：行 x 坐标聚类找栏（修 P34）。
    方法：
      1. 收集每行的 x 中点（不是最左 x0，更稳健）
      2. 找 top-N 大 gap
      3. 至少 min_lines_per_col 行才认作一栏
    Returns: {"columns": int, "column_boundaries": [(x0, x1), ...]}
    """
    if not lines:
        return {"columns": 1, "column_boundaries": [(0, page_width)]}

    # 1. 每行 x 中点（更代表「栏中心」）
    line_x_mids = []
    for line in lines:
        if not line:
            continue
        xs = [(w["bbox"][0] + w["bbox"][2]) / 2 for w in line]
        line_x_mids.append(sum(xs) / len(xs))

    if len(line_x_mids) < 2:
        return {"columns": 1, "column_boundaries": [(0, page_width)]}

    # 2. 找 gap
    sorted_mids = sorted(line_x_mids)
    gaps = []
    for i in range(len(sorted_mids) - 1):
        gap_size = sorted_mids[i + 1] - sorted_mids[i]
        gap_center = (sorted_mids[i] + sorted_mids[i + 1]) / 2
        gaps.append((gap_size, gap_center))
    gaps.sort(reverse=True)

    # 3. 找所有「显著」gap（> min_gap_ratio * page_width）
    significant_gaps = [
        (gap_size, gap_center) for gap_size, gap_center in gaps
        if gap_size >= page_width * min_gap_ratio
    ]

    if not significant_gaps:
        return {"columns": 1, "column_boundaries": [(0, page_width)]}

    # 4. 用 gap 中心分栏
    boundaries = [0.0] + [g[1] for g in significant_gaps] + [page_width]
    boundaries = sorted(set(boundaries))
    column_boundaries = [(boundaries[i], boundaries[i + 1])
                         for i in range(len(boundaries) - 1)]

    # 5. 过滤：每栏至少 min_lines_per_col 行
    # 统计每栏实际包含的行数
    column_line_counts = [0] * len(column_boundaries)
    for line in lines:
        if not line:
            continue
        x_mid = sum((w["bbox"][0] + w["bbox"][2]) / 2 for w in line) / len(line)
        for i, (cx0, cx1) in enumerate(column_boundaries):
            if cx0 <= x_mid < cx1:
                column_line_counts[i] += 1
                break

    # 保留行数足够的栏
    valid_boundaries = [
        b for i, b in enumerate(column_boundaries)
        if column_line_counts[i] >= min_lines_per_col
    ]

    if len(valid_boundaries) <= 1:
        return {"columns": 1, "column_boundaries": [(0, page_width)]}

    return {
        "columns": len(valid_boundaries),
        "column_boundaries": valid_boundaries,
    }


def assign_to_column(line, column_boundaries):
    """判断一行属于哪一栏（按行 x 中点）。"""
    if not line:
        return 0
    x_mid = sum((w["bbox"][0] + w["bbox"][2]) / 2 for w in line) / len(line)
    for i, (cx0, cx1) in enumerate(column_boundaries):
        if cx0 <= x_mid < cx1:
            return i
    return 0


def line_to_text(line) -> str:
    """一行 words → 文本（words 间加空格）。"""
    if not line:
        return ""
    return " ".join(w["text"] for w in line)


def parse_columns_from_words(words: list[dict], page_width: float,
                             page_height: float, y_tolerance: float = 3.0,
                             min_gap_ratio: float = 0.15,
                             image_bboxes: list[tuple] | None = None,
                             min_lines_per_col: int = 3) -> dict:
    """主入口 v0.2。
    words: [{"text": str, "bbox": (x0, y0, x1, y1)}, ...]
    image_bboxes: 图表 bbox 列表（修 P35）
    Returns: {"text": str, "lines": list, "columns": int, "column_boundaries": [...]}
    """
    if not words:
        return {"text": "", "lines": [], "columns": 1, "column_boundaries": [(0, page_width)]}

    # 0. 过滤图区域 word（修 P35）
    if image_bboxes:
        words = filter_words_in_images(words, image_bboxes)

    if not words:
        return {"text": "", "lines": [], "columns": 1, "column_boundaries": [(0, page_width)]}

    # 1. 按行聚类
    lines = cluster_lines(words, y_tolerance=y_tolerance)

    # 2. 检测栏数（v0.2 众数法 + 多 gap）
    col_info = detect_columns(lines, page_width,
                              min_gap_ratio=min_gap_ratio,
                              min_lines_per_col=min_lines_per_col)
    columns = col_info["columns"]
    column_boundaries = col_info["column_boundaries"]

    # 3. 按栏分组
    column_lines = [[] for _ in range(columns)]
    for line in lines:
        col_idx = assign_to_column(line, column_boundaries)
        column_lines[col_idx].append(line)

    # 4. 重组文本
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
        "column_boundaries": column_boundaries,
    }


# ---------- 兼容旧 API（character-level，v0.1 备用） ----------

def parse_columns(bboxes, page_size: tuple, y_tolerance: float = 3.0,
                  min_gap_ratio: float = 0.15) -> dict:
    """旧入口（character-level bbox）。已弃用。"""
    import sys
    print("WARN: parse_columns（字符级）已弃用，请用 parse_columns_from_words",
          file=sys.stderr)
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

"""
quality_check v0.2: PDF 抽取输出自评
v0.2 改进（P36 修复）：
- 加 column_coverage 维：layout 输出 Column 2+ 内容占比
- 加 chart_text_ratio 维：图表 bbox 内 word 占比
- 4 维各 0.25 权重
- auto 阈值从 0.6 提到 0.75

5 维：anchor_density / ocr_likely / garbled_ratio / column_coverage / chart_text_ratio
"""

import re
import string


# ---------- 单项检查 ----------

def check_anchor_density(pages: list[dict], min_chars_per_page: int = 100) -> float:
    """每页有效字符数。pages: [{page_num, text, lines}, ...]
    返回 0-1 分数：1.0 = 所有页都达标，0.0 = 全部为空
    """
    if not pages:
        return 0.0
    scores = []
    for page in pages:
        char_count = sum(len(line) for line in page["lines"])
        if char_count == 0:
            scores.append(0.0)
        elif char_count < min_chars_per_page:
            scores.append(char_count / (2 * min_chars_per_page))
        else:
            scores.append(min(1.0, 0.5 + (char_count - min_chars_per_page) / (2 * min_chars_per_page)))
    return sum(scores) / len(scores)


def check_ocr_likely(text: str) -> float:
    """OCR 误识别检测。返回 0-1：1.0 = 像 OCR 输出（差），0.0 = 像正常文本。
    """
    if not text or len(text) < 50:
        return 0.5

    lines = text.split("\n")
    total_lines = len(lines)
    if total_lines == 0:
        return 0.5

    suspicious = 0
    words = re.findall(r"\S+", text)
    if not words:
        return 0.5
    short_words = [w for w in words if len(w) <= 1]
    short_ratio = len(short_words) / len(words)
    if short_ratio > 0.3:
        suspicious += 1

    double_space_lines = sum(1 for line in lines if "  " in line)
    if total_lines > 0 and double_space_lines / total_lines > 0.5:
        suspicious += 1

    confusion_patterns = [
        r"\b[O0]{3,}\b",
        r"\b[lI1]{3,}\b",
        r"\brn\b",
    ]
    for pattern in confusion_patterns:
        matches = re.findall(pattern, text)
        if len(matches) > len(words) * 0.05:
            suspicious += 1

    return min(1.0, suspicious / 3.0)


def check_garbled_ratio(text: str, max_unprintable_ratio: float = 0.05) -> float:
    """乱码率。返回 0-1：1.0 = 大量乱码（差），0.0 = 文本干净。"""
    if not text:
        return 1.0

    printable = set(string.printable) | {"\n", "\t", "\r", " "}
    bad_chars = sum(1 for c in text if c not in printable and ord(c) < 0xFFFD)
    replacement_chars = text.count("�")
    bad_chars += replacement_chars

    ratio = bad_chars / len(text) if text else 0
    if ratio == 0:
        return 0.0
    elif ratio < max_unprintable_ratio:
        return ratio / max_unprintable_ratio
    else:
        return 1.0


def check_column_coverage(full_text: str) -> float:
    """v0.2 新增：双栏覆盖率（修 P36）。
    检 `=== Column N ===` 标记，统计 Column 2+ 的内容占比。
    返回 0-1：1.0 = 完美双栏分布（每栏约 50%），0.0 = 全部内容集中在 Column 1。
    """
    if not full_text:
        return 0.0

    # 解析 Column 标记
    parts = re.split(r"=== Column (\d+) ===", full_text)
    if len(parts) < 3:
        # 无 Column 标记（单栏文档），覆盖率不适用 = 给中性分
        return 0.7

    # parts: [pre, "1", col1, "2", col2, "3", col3, ...]
    column_lengths = {}
    for i in range(1, len(parts) - 1, 2):
        col_num = int(parts[i])
        col_text = parts[i + 1]
        column_lengths[col_num] = len(col_text.strip())

    if not column_lengths or len(column_lengths) < 2:
        return 0.7  # 单栏，N/A

    total = sum(column_lengths.values())
    if total == 0:
        return 0.0

    # Column 2+ 占比（应 ≈ 0.5 for 2 栏，≈ 0.66 for 3 栏）
    n_cols = len(column_lengths)
    expected_non_col1 = 1 - 1 / n_cols
    actual_non_col1 = sum(v for k, v in column_lengths.items() if k > 1) / total

    # 与期望值偏差
    coverage = actual_non_col1 / expected_non_col1 if expected_non_col1 > 0 else 0
    return min(1.0, coverage)


def check_chart_text_ratio(pages: list[dict]) -> float:
    """v0.2 新增：图表文本污染比（修 P36 间接修 P35）。
    看每页 image_count 比例 + 输出文本中"看起来像图标签"的行比例。
    返回 0-1：1.0 = 干净（无图污染），0.0 = 严重污染。
    """
    if not pages:
        return 0.7

    # 启发式：检测「孤立短词 + 数字 + 字母」行（如 "150", "SL-CAI"）— 像图坐标轴
    chart_label_patterns = [
        r"^\d+$",  # 纯数字（如 100, 150, 200）
        r"^[A-Z]{1,3}[-]?[A-Z]{1,5}$",  # 短大写（如 SL-CAI, RLHF, HH）
        r"^\d+\s+\d+(\s+\d+)+$",  # 多个数字（坐标轴刻度）
    ]
    suspicious_lines = 0
    total_lines = 0
    pages_with_images = 0

    for page in pages:
        total_lines += len(page.get("lines", []))
        if page.get("image_count", 0) > 0:
            pages_with_images += 1
        for line in page.get("lines", []):
            line = line.strip()
            if not line or len(line) > 80:
                continue
            for pattern in chart_label_patterns:
                if re.match(pattern, line):
                    suspicious_lines += 1
                    break

    if total_lines == 0:
        return 0.5

    # 污染率 = (可疑行 / 总行)
    pollution = suspicious_lines / total_lines

    # 转换成 0-1 分（污染率越低分越高）
    if pollution < 0.02:
        return 1.0
    elif pollution < 0.05:
        return 0.7
    elif pollution < 0.10:
        return 0.4
    else:
        return 0.0


# ---------- 综合打分 ----------

def score(full_text: str, pages: list[dict] | None = None) -> dict:
    """v0.2 综合打分 0-1（4 维各 0.25）。
    Returns: {"final": 0.85, "density": ..., "ocr": ..., "garbled": ...,
              "column_coverage": ..., "chart_text_ratio": ...}
    """
    if pages is None:
        pages = [{"text": full_text, "lines": full_text.split("\n"),
                  "image_count": 0}]

    # 确保 pages 有 image_count 字段（向后兼容 v0.1 调用）
    for p in pages:
        p.setdefault("image_count", 0)

    density = check_anchor_density(pages)
    ocr = check_ocr_likely(full_text)
    garbled = check_garbled_ratio(full_text)
    column_cov = check_column_coverage(full_text)
    chart_ratio = check_chart_text_ratio(pages)

    # 5 维权重（v0.2: 4 维均等 + column_cov 是「加分」非「扣分」）
    # 注意：column_coverage 是 layout 模式专属；单栏文档 0.7 中性分
    final = (
        density * 0.30 +
        (1 - ocr) * 0.20 +
        (1 - garbled) * 0.20 +
        column_cov * 0.15 +
        chart_ratio * 0.15
    )
    return {
        "final": round(final, 3),
        "density": round(density, 3),
        "ocr": round(ocr, 3),
        "garbled": round(garbled, 3),
        "column_coverage": round(column_cov, 3),
        "chart_text_ratio": round(chart_ratio, 3),
    }


# ---------- CLI 测试用 ----------

if __name__ == "__main__":
    import sys
    if len(sys.argv) < 2:
        print("Usage: python3 quality_check.py <markdown-file>")
        sys.exit(1)
    with open(sys.argv[1], "r", encoding="utf-8", errors="ignore") as f:
        text = f.read()
    pages = [{"text": text, "lines": text.split("\n"), "image_count": 0}]
    result = score(text, pages)
    for k, v in result.items():
        print(f"{k:20s} {v}")

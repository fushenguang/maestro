"""
quality_check: PDF 抽取输出自评
3 个指标：anchor_density / ocr_likely / garbled_ratio
综合打分 0-1，< 0.6 触发 fallback
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
        # 用 sigmoid-like 函数：0 → 0, 100 → 0.5, 200+ → 1.0
        if char_count == 0:
            scores.append(0.0)
        elif char_count < min_chars_per_page:
            scores.append(char_count / (2 * min_chars_per_page))
        else:
            # 超过 200 字符不再加分
            scores.append(min(1.0, 0.5 + (char_count - min_chars_per_page) / (2 * min_chars_per_page)))
    return sum(scores) / len(scores)


def check_ocr_likely(text: str) -> float:
    """OCR 误识别检测。返回 0-1：1.0 = 像 OCR 输出（差），0.0 = 像正常文本。
    检测模式：
      - 大量单字符间空格（"t h e" 而非 "the"）
      - 大量行内多余空格
      - 常见 OCR 误识别（l↔1, 0↔O, rn↔m）
    """
    if not text or len(text) < 50:
        return 0.5  # 太短无法判断

    lines = text.split("\n")
    total_lines = len(lines)
    if total_lines == 0:
        return 0.5

    suspicious = 0

    # 1. 单字符间空格比例
    # 正常文本：单词平均长度 4-7
    words = re.findall(r"\S+", text)
    if not words:
        return 0.5
    short_words = [w for w in words if len(w) <= 1]
    short_ratio = len(short_words) / len(words)
    if short_ratio > 0.3:  # > 30% 单字符词
        suspicious += 1

    # 2. 行内多余双空格
    double_space_lines = sum(1 for line in lines if "  " in line)
    if total_lines > 0 and double_space_lines / total_lines > 0.5:
        suspicious += 1

    # 3. 常见 OCR 混淆（l1, 0O, rn/m）
    # 在数字与字母混合的 token 中（如 ID、版本号）易错
    confusion_patterns = [
        r"\b[O0]{3,}\b",  # 连续 O/0
        r"\b[lI1]{3,}\b",  # 连续 l/I/1
        r"\brn\b",  # 单词边界 rn（可能应为 m）
    ]
    for pattern in confusion_patterns:
        matches = re.findall(pattern, text)
        if len(matches) > len(words) * 0.05:  # > 5% 词命中
            suspicious += 1

    # 归一化
    return min(1.0, suspicious / 3.0)


def check_garbled_ratio(text: str, max_unprintable_ratio: float = 0.05) -> float:
    """乱码率。返回 0-1：1.0 = 大量乱码（差），0.0 = 文本干净。
    '乱码' 定义：连续不可打印字符 / 控制字符 / 替代字符（U+FFFD）
    """
    if not text:
        return 1.0

    # 不可打印 = 控制字符（除 \n \t \r）+ 替换字符
    printable = set(string.printable) | {"\n", "\t", "\r", " "}
    bad_chars = sum(1 for c in text if c not in printable and ord(c) < 0xFFFD)
    replacement_chars = text.count("�")
    bad_chars += replacement_chars

    ratio = bad_chars / len(text) if text else 0

    if ratio == 0:
        return 0.0
    elif ratio < max_unprintable_ratio:
        return ratio / max_unprintable_ratio  # 0-1
    else:
        return 1.0  # 超出阈值直接 1.0


# ---------- 综合打分 ----------

def score(full_text: str, pages: list[dict] | None = None) -> float:
    """综合打分 0-1。
    weight: anchor_density 0.4 + (1 - ocr_likely) 0.3 + (1 - garbled) 0.3
    """
    if pages is None:
        # 退化：仅靠 full_text
        pages = [{"text": full_text, "lines": full_text.split("\n")}]

    density = check_anchor_density(pages)
    ocr = check_ocr_likely(full_text)
    garbled = check_garbled_ratio(full_text)

    # 整体：密度高 + 不像 OCR + 不乱码 = 高分
    final = density * 0.4 + (1 - ocr) * 0.3 + (1 - garbled) * 0.3
    return round(final, 3)


# ---------- CLI 测试用 ----------

if __name__ == "__main__":
    import sys
    if len(sys.argv) < 2:
        print("Usage: python3 quality_check.py <markdown-file>")
        sys.exit(1)
    with open(sys.argv[1], "r", encoding="utf-8", errors="ignore") as f:
        text = f.read()
    pages = [{"text": text, "lines": text.split("\n")}]
    s = score(text, pages)
    print(f"density:    {check_anchor_density(pages):.3f}")
    print(f"ocr_likely: {check_ocr_likely(text):.3f}")
    print(f"garbled:    {check_garbled_ratio(text):.3f}")
    print(f"FINAL:      {s:.3f}")

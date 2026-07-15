#!/usr/bin/env python3
"""
HermesDocs 星等評分設定工具

Usage:
  python3 set-rating.py <filename> <rating>
  python3 set-rating.py list

Examples:
  python3 set-rating.py my-article.html 4
  python3 set-rating.py list
"""
import os
import sys
import json
import glob

BASE_DIR = os.path.abspath(os.path.join(os.path.dirname(__file__), ".."))
DOCS_DIR = os.path.join(BASE_DIR, "docs")
VIDEOS_DIR = os.path.join(DOCS_DIR, "videos")
RATINGS_PATH = os.path.join(DOCS_DIR, "assets", "data", "ratings.json")


def load_ratings() -> dict:
    if not os.path.isfile(RATINGS_PATH):
        return {}
    try:
        with open(RATINGS_PATH, "r", encoding="utf-8") as f:
            return json.load(f)
    except (json.JSONDecodeError, OSError):
        return {}


def save_ratings(ratings: dict):
    os.makedirs(os.path.dirname(RATINGS_PATH), exist_ok=True)
    with open(RATINGS_PATH, "w", encoding="utf-8") as f:
        json.dump(ratings, f, ensure_ascii=False, indent=2)


def list_articles():
    ratings = load_ratings()
    files = sorted(glob.glob(os.path.join(VIDEOS_DIR, "*.html")))
    if not files:
        print("📭 尚無文件")
        return
    print(f"{'檔案名稱':<40} {'星等':<8} {'標題'}")
    print("-" * 80)
    for fpath in files:
        fname = os.path.basename(fpath)
        rating = ratings.get(fname, 0)
        stars = "★" * rating + "☆" * (5 - rating) if rating > 0 else "—"
        title = extract_title(fpath)
        print(f"{fname:<40} {stars:<8} {title}")


def extract_title(html_path: str) -> str:
    import re
    with open(html_path, "r", encoding="utf-8") as f:
        content = f.read()
    match = re.search(r"<title>\s*(.*?)\s*</title>", content, re.IGNORECASE | re.DOTALL)
    if match:
        return match.group(1).strip()
    return os.path.splitext(os.path.basename(html_path))[0]


def main():
    if len(sys.argv) < 2:
        print("Usage:")
        print("  python3 set-rating.py <filename> <rating>")
        print("  python3 set-rating.py list")
        sys.exit(1)

    if sys.argv[1] == "list":
        list_articles()
        return

    if len(sys.argv) < 3:
        print("❌ 請提供檔名與星等（1-5）")
        print("Usage: python3 set-rating.py <filename> <rating>")
        sys.exit(1)

    filename = sys.argv[1]
    try:
        rating = int(sys.argv[2])
    except ValueError:
        print("❌ 星等必須為 1-5 的整數")
        sys.exit(1)

    if rating < 1 or rating > 5:
        print("❌ 星等必須為 1-5 的整數")
        sys.exit(1)

    # 檢查檔案是否存在
    article_path = os.path.join(VIDEOS_DIR, filename)
    if not os.path.isfile(article_path):
        print(f"❌ 找不到檔案：{filename}")
        print(f"   預期路徑：{article_path}")
        print("   可用 'python3 set-rating.py list' 查看現有文件")
        sys.exit(1)

    ratings = load_ratings()
    ratings[filename] = rating
    save_ratings(ratings)

    stars = "★" * rating + "☆" * (5 - rating)
    print(f"✅ 已設定 {filename} 為 {stars} ({rating}/5)")
    print("")
    print("⚠️  設定後請執行 deploy.py 重新發布以更新網站：")


if __name__ == "__main__":
    main()

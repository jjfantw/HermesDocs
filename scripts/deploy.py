#!/usr/bin/env python3
"""
HermesDocs 自動化發布腳本 (v2 — 雙軌發布)
Usage: python3 deploy.py <path/to/new_article.html>

流程：
  1. 複製新文章至 docs/videos/
  2. 掃描 docs/videos/ 所有 HTML，重新渲染首頁
  3. Google Drive 備份（try-except 保護，失敗不影響發布）
  4. Git add → commit → push
  5. 輪詢 Cloudflare Pages 驗證部署成功
"""

import os
import re
import json
import sys
import glob
import time
import shutil
import subprocess
import urllib.request
import urllib.error
from datetime import datetime, timezone

# ── 路徑設定 ──────────────────────────────────────────────
BASE_DIR = os.path.abspath(os.path.join(os.path.dirname(__file__), ".."))
DOCS_DIR = os.path.join(BASE_DIR, "docs")
VIDEOS_DIR = os.path.join(DOCS_DIR, "videos")
TEMPLATES_DIR = os.path.join(BASE_DIR, "scripts", "templates")
INDEX_TEMPLATE = os.path.join(TEMPLATES_DIR, "index.template.html")
INDEX_OUTPUT = os.path.join(DOCS_DIR, "index.html")
SITE_URL = "https://hermesdocs.pages.dev"
POLL_INTERVAL = 10  # seconds
POLL_TIMEOUT = 180  # seconds

# ── Google Drive 路徑 ─────────────────────────────────────
# Drive for Desktop 掛載點（zh-Hant locale）
DRIVE_ROOT = os.path.expanduser("~/Google Drive/我的雲端硬碟")
HERMES_DRIVE_DIR = os.path.join(DRIVE_ROOT, "Hermes")


def log(msg: str):
    timestamp = datetime.now().strftime("%Y-%m-%d %H:%M:%S")
    print(f"[{timestamp}] {msg}")


def run_cmd(cmd: list, cwd: str = BASE_DIR) -> tuple[str, str, int]:
    """Run a shell command and return (stdout, stderr, exit_code)."""
    result = subprocess.run(cmd, capture_output=True, text=True, cwd=cwd)
    return result.stdout.strip(), result.stderr.strip(), result.returncode


def extract_plain_text(html_path: str) -> str:
    """Strip HTML tags from an article, return clean text for search indexing."""
    with open(html_path, "r", encoding="utf-8") as f:
        content = f.read()
    # Remove <style> and <script> blocks
    content = re.sub(r"<style[^>]*>.*?</style>", "", content, flags=re.DOTALL | re.IGNORECASE)
    content = re.sub(r"<script[^>]*>.*?</script>", "", content, flags=re.DOTALL | re.IGNORECASE)
    # Remove HTML tags
    content = re.sub(r"<[^>]+>", " ", content)
    # Decode common entities
    content = content.replace("&nbsp;", " ").replace("&amp;", "&").replace("&lt;", "<").replace("&gt;", ">").replace("&quot;", "\"").replace("&#39;", "'")
    # Collapse whitespace
    content = re.sub(r"\s+", " ", content).strip()
    return content


def build_search_index(entries: list[dict]) -> list[dict]:
    """Build search index from all articles (title + plain text)."""
    index = []
    for e in entries:
        text = extract_plain_text(e["path"])
        index.append({
            "title": e["title"],
            "url": f"videos/{e['filename']}",
            "date": datetime.fromtimestamp(e["mtime"], tz=timezone.utc).strftime("%Y-%m-%d %H:%M"),
            "content": text[:500],  # 全文索引，存前 500 字
        })
    return index


def extract_title(html_path: str) -> str:
    """Extract <title> from an HTML file."""
    with open(html_path, "r", encoding="utf-8") as f:
        content = f.read()
    match = re.search(r"<title>\s*(.*?)\s*</title>", content, re.IGNORECASE | re.DOTALL)
    if match:
        return match.group(1).strip()
    return os.path.splitext(os.path.basename(html_path))[0]


def scan_video_docs() -> list[dict]:
    """Scan docs/videos/ for HTML files, return sorted list (newest first)."""
    files = glob.glob(os.path.join(VIDEOS_DIR, "*.html"))
    entries = []
    for fpath in files:
        title = extract_title(fpath)
        mtime = os.path.getmtime(fpath)
        entries.append({
            "path": fpath,
            "filename": os.path.basename(fpath),
            "title": title,
            "mtime": mtime,
        })
    entries.sort(key=lambda e: e["mtime"], reverse=True)
    return entries


def render_index(entries: list[dict]) -> str:
    """Render index.html from template and doc entries."""
    with open(INDEX_TEMPLATE, "r", encoding="utf-8") as f:
        template = f.read()

    # Build doc list HTML
    if not entries:
        list_html = '<li class="placeholder">📄 尚無文件 — 即將新增</li>'
    else:
        items = []
        for e in entries:
            dt = datetime.fromtimestamp(e["mtime"], tz=timezone.utc).strftime("%Y-%m-%d %H:%M")
            items.append(
                f'<li><a href="videos/{e["filename"]}">{e["title"]}</a>'
                f'<div class="doc-meta">{dt}</div></li>'
            )
        list_html = "\n".join(items)

    now_str = datetime.now(tz=timezone.utc).strftime("%Y-%m-%d %H:%M UTC")
    template = template.replace("<!--__DOC_LIST__-->", list_html)
    template = template.replace("<!--__LAST_UPDATED__-->", now_str)

    return template


def upload_to_drive(article_path: str, article_title: str) -> bool:
    """
    Copy article + index.html to Google Drive sync folder.
    Uses Drive for Desktop (方案 A) — no API needed.
    Returns True if successful, False on failure (non-blocking).
    """
    try:
        if not os.path.isdir(DRIVE_ROOT):
            log("⚠️  Google Drive root not found — skipping Drive backup")
            return False

        # Create dated folder under Hermes/
        today_str = datetime.now().strftime("%Y-%m-%d")
        drive_folder = os.path.join(HERMES_DRIVE_DIR, f"{today_str}_HermesDocs")
        os.makedirs(drive_folder, exist_ok=True)

        # Copy article HTML
        article_filename = os.path.basename(article_path)
        drive_article_path = os.path.join(drive_folder, article_filename)
        shutil.copy2(article_path, drive_article_path)
        log(f"☁️  Copied article → Google Drive: {drive_article_path}")

        # Copy index.html
        drive_index_path = os.path.join(drive_folder, "index.html")
        shutil.copy2(INDEX_OUTPUT, drive_index_path)
        log(f"☁️  Copied index.html → Google Drive: {drive_index_path}")

        log(f"✅ Google Drive backup complete ({drive_folder})")
        return True

    except Exception as e:
        log(f"⚠️  Google Drive backup failed (non-blocking): {e}")
        return False


def git_has_changes() -> bool:
    """Check if there are uncommitted changes."""
    stdout, _, rc = run_cmd(["git", "status", "--porcelain"])
    return bool(stdout.strip())


def git_commit_and_push(title: str) -> bool:
    """Add, commit, and push. Returns True on success."""
    log("📦 Staging changes...")
    run_cmd(["git", "add", "."])

    commit_msg = f"docs: release new document {title}"
    log(f"💬 Committing: {commit_msg}")
    _, stderr, rc = run_cmd(["git", "commit", "-m", commit_msg])
    if rc != 0:
        log(f"⚠️  Commit failed: {stderr}")
        return False

    log("🚀 Pushing to origin/main...")
    _, stderr, rc = run_cmd(["git", "push", "origin", "main"])
    if rc != 0:
        log(f"⚠️  Push failed: {stderr}")
        return False

    log("✅ Push successful")
    return True


def poll_deployment(title: str) -> bool:
    """Poll Cloudflare Pages until the new article title appears."""
    log(f"🔍 Polling {SITE_URL} for '{title}'...")
    start = time.time()
    while time.time() - start < POLL_TIMEOUT:
        elapsed = int(time.time() - start)
        try:
            req = urllib.request.Request(SITE_URL, headers={"User-Agent": "HermesDocs-Deploy"})
            with urllib.request.urlopen(req, timeout=10) as resp:
                body = resp.read().decode("utf-8")
                if title in body:
                    log(f"✅ Deployment verified! '{title}' found on site ({elapsed}s)")
                    return True
                else:
                    log(f"⏳ Site updated but '{title}' not yet visible ({elapsed}s)")
        except urllib.error.URLError as e:
            log(f"⏳ Site unreachable ({elapsed}s): {e.reason}")
        except Exception as e:
            log(f"⏳ Poll error ({elapsed}s): {e}")

        time.sleep(POLL_INTERVAL)

    log(f"⚠️  Timeout: '{title}' not found after {POLL_TIMEOUT}s")
    return False


def main():
    if len(sys.argv) < 2:
        print("Usage: python3 deploy.py <path/to/new_article.html>")
        sys.exit(1)

    src_path = os.path.abspath(sys.argv[1])
    if not os.path.isfile(src_path):
        log(f"❌ File not found: {src_path}")
        sys.exit(1)

    # ── 1. Copy article to videos/ ──
    title = extract_title(src_path)
    filename = os.path.basename(src_path)
    dest_path = os.path.join(VIDEOS_DIR, filename)
    if os.path.normpath(src_path) == os.path.normpath(dest_path):
        log(f"📄 Article already in videos/ — skipping copy")
    else:
        shutil.copy2(src_path, dest_path)
        log(f"📄 Copied '{filename}' → {dest_path}")

    # ── 2. Re-render index ──
    entries = scan_video_docs()
    log(f"📋 Found {len(entries)} document(s) in videos/")
    index_html = render_index(entries)
    with open(INDEX_OUTPUT, "w", encoding="utf-8") as f:
        f.write(index_html)
    log(f"🏠 Updated index.html ({len(entries)} entries)")

    # ── 2.5 Build search index ──
    search_index = build_search_index(entries)
    search_index_path = os.path.join(DOCS_DIR, "assets", "js", "search-index.json")
    os.makedirs(os.path.dirname(search_index_path), exist_ok=True)
    with open(search_index_path, "w", encoding="utf-8") as f:
        json.dump(search_index, f, ensure_ascii=False, indent=2)
    log(f"🔍 Built search index ({len(search_index)} entries) → {search_index_path}")

    # ── 3. Google Drive backup (non-blocking) ──
    upload_to_drive(src_path, title)

    # ── 4. Git automation ──
    if not git_has_changes():
        log("No changes detected. Sync stopped.")
        sys.exit(0)

    if not git_commit_and_push(title):
        log("❌ Git push failed. Aborting deployment verification.")
        sys.exit(1)

    # ── 5. Poll Cloudflare Pages ──
    poll_deployment(title)
    log("🎉 Deployment process complete!")


if __name__ == "__main__":
    main()

/**
 * HermesDocs 星等評分 API (方案 C — Git API 自動回寫)
 *
 * GET  /api/rating          → 回傳所有星等 {filename: rating}
 * POST /api/rating          → 更新單篇星等 {filename, rating}
 *       需 env.GH_TOKEN (GitHub Personal Access Token, repo 權限)
 *
 * Cloudflare Pages Functions 文件：
 *   https://developers.cloudflare.com/pages/functions/
 */

// ── GitHub 設定 ──────────────────────────────────────────
const GH_OWNER = "jjfantw";
const GH_REPO = "HermesDocs";
const GH_BRANCH = "main";
const RATINGS_PATH = "docs/assets/data/ratings.json";

function getHeaders(token) {
  return {
    Authorization: `token ${token}`,
    Accept: "application/vnd.github.v3+json",
    "User-Agent": "HermesDocs-Rating-API",
  };
}

/**
 * 從 GitHub 讀取 ratings.json 內容
 * 回傳 { content: {filename: rating}, sha: "..." }
 */
async function fetchRatingsFromGitHub(token) {
  const url = `https://api.github.com/repos/${GH_OWNER}/${GH_REPO}/contents/${RATINGS_PATH}?ref=${GH_BRANCH}`;
  const resp = await fetch(url, { headers: getHeaders(token) });
  if (!resp.ok) {
    const text = await resp.text();
    throw new Error(`GitHub API GET failed (${resp.status}): ${text}`);
  }
  const data = await resp.json();
  const decoded = atob(data.content);
  return { content: JSON.parse(decoded), sha: data.sha };
}

/**
 * 寫入 ratings.json 到 GitHub（直接 commit）
 */
async function writeRatingsToGitHub(token, ratings, sha) {
  const url = `https://api.github.com/repos/${GH_OWNER}/${GH_REPO}/contents/${RATINGS_PATH}`;
  const encoded = btoa(JSON.stringify(ratings, null, 2) + "\n");
  const body = {
    message: "docs: update rating via web UI",
    content: encoded,
    sha: sha,
    branch: GH_BRANCH,
  };
  const resp = await fetch(url, {
    method: "PUT",
    headers: getHeaders(token),
    body: JSON.stringify(body),
  });
  if (!resp.ok) {
    const text = await resp.text();
    throw new Error(`GitHub API PUT failed (${resp.status}): ${text}`);
  }
  const data = await resp.json();
  return data.content.sha;
}

// ── CORS headers ─────────────────────────────────────────
const CORS_HEADERS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type",
};

// ── Handler ──────────────────────────────────────────────
export async function onRequest(context) {
  const { request, env } = context;

  // CORS preflight
  if (request.method === "OPTIONS") {
    return new Response(null, { status: 204, headers: CORS_HEADERS });
  }

  // 檢查 GitHub token
  const token = env.GH_TOKEN;
  if (!token) {
    return new Response(
      JSON.stringify({ error: "GH_TOKEN not configured" }),
      { status: 500, headers: { ...CORS_HEADERS, "Content-Type": "application/json" } }
    );
  }

  try {
    // ── GET: 讀取所有星等 ──
    if (request.method === "GET") {
      const { content } = await fetchRatingsFromGitHub(token);
      return new Response(JSON.stringify(content), {
        headers: { ...CORS_HEADERS, "Content-Type": "application/json" },
      });
    }

    // ── POST: 更新單篇星等 ──
    if (request.method === "POST") {
      const body = await request.json();
      const { filename, rating } = body;

      if (!filename || typeof rating !== "number" || rating < 0 || rating > 5) {
        return new Response(
          JSON.stringify({ error: "Invalid input. Need filename (string) and rating (0-5)." }),
          { status: 400, headers: { ...CORS_HEADERS, "Content-Type": "application/json" } }
        );
      }

      // 讀取現有 ratings.json
      const { content: ratings, sha } = await fetchRatingsFromGitHub(token);

      // 更新
      if (rating === 0) {
        delete ratings[filename];
      } else {
        ratings[filename] = rating;
      }

      // 寫回 GitHub
      const newSha = await writeRatingsToGitHub(token, ratings, sha);

      return new Response(
        JSON.stringify({
          success: true,
          filename,
          rating,
          sha: newSha,
          message: "Rating updated. Cloudflare Pages will auto-deploy (~30-60s).",
        }),
        { headers: { ...CORS_HEADERS, "Content-Type": "application/json" } }
      );
    }

    // ── 其他方法 ──
    return new Response(
      JSON.stringify({ error: "Method not allowed" }),
      { status: 405, headers: { ...CORS_HEADERS, "Content-Type": "application/json" } }
    );
  } catch (err) {
    return new Response(
      JSON.stringify({ error: err.message }),
      { status: 500, headers: { ...CORS_HEADERS, "Content-Type": "application/json" } }
    );
  }
}

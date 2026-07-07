# Hermes Docs

AI 文件發布平台 — 自動化產出、管理與展示技術文件。

## 專案用途

Hermes Docs 是一個由 AI 自動化驅動的文件發布平台，主要用於：

- 存放與管理各類技術文件、教學資源與專案說明
- 提供響應式網頁介面供瀏覽與搜尋
- 透過 Git 版本控制追蹤文件變更歷程
- 未來可整合 CI/CD 自動發布流程

## 目錄結構

```
~/HermesDocs/
├── src/                  # 原始碼與開發資源
├── docs/                 # 網站靜態檔案（發布用）
│   ├── index.html        # 網站首頁
│   ├── assets/           # 靜態資源
│   │   ├── css/          # 樣式表
│   │   ├── js/           # JavaScript
│   │   └── images/       # 圖片
│   └── videos/           # 影片資源
├── scripts/              # 輔助腳本
│   └── templates/        # 文件模板
├── README.md             # 本文件
└── .gitignore            # Git 忽略規則
```

## 發布流程

1. 在 `docs/` 目錄下新增或修改文件
2. 執行 `git add .` 與 `git commit` 提交變更
3. 推送至遠端倉庫（待設定）
4. （未來）自動部署至靜態網站服務

## 如何新增文件

1. 在 `docs/` 下建立對應的 HTML 或 Markdown 檔案
2. 靜態資源（CSS/JS/圖片）放置於 `docs/assets/` 對應子目錄
3. 更新 `docs/index.html` 中的文件列表
4. 提交並推送變更

---

*由 Hermes Agent 自動初始化*

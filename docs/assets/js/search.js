/**
 * HermesDocs 客戶端搜尋引擎
 * 載入 search-index.json，輸入即搜尋，即時過濾
 */
(function () {
  'use strict';

  let searchIndex = [];
  let searchInput = document.getElementById('search-input');
  let resultsContainer = document.getElementById('search-results');

  if (!searchInput || !resultsContainer) return;

  // ── 載入索引 ──
  fetch('assets/js/search-index.json')
    .then(function (r) { return r.json(); })
    .then(function (data) {
      searchIndex = data;
    })
    .catch(function () {
      resultsContainer.innerHTML =
        '<p class="search-error">⚠️ 搜尋索引載入失敗，請重新整理頁面</p>';
    });

  // ── 防抖 ──
  var debounceTimer;
  searchInput.addEventListener('input', function () {
    clearTimeout(debounceTimer);
    debounceTimer = setTimeout(function () {
      doSearch(searchInput.value.trim());
    }, 200);
  });

  // ── 搜尋邏輯 ──
  function doSearch(query) {
    if (!query) {
      resultsContainer.innerHTML = '';
      resultsContainer.classList.remove('has-results');
      return;
    }

    var q = query.toLowerCase();
    var results = [];

    for (var i = 0; i < searchIndex.length; i++) {
      var doc = searchIndex[i];
      var titleMatch = doc.title.toLowerCase().indexOf(q) !== -1;
      var contentMatch = doc.content.toLowerCase().indexOf(q) !== -1;

      if (titleMatch || contentMatch) {
        var snippet = '';
        if (contentMatch) {
          snippet = extractSnippet(doc.content, q);
        } else {
          snippet = doc.content.substring(0, 80) + '…';
        }
        results.push({
          title: doc.title,
          url: doc.url,
          date: doc.date,
          snippet: snippet,
          isTitleMatch: titleMatch
        });
      }
    }

    renderResults(results, query);
  }

  // ── 摘要片段（關鍵字前後截取） ──
  function extractSnippet(text, query) {
    var lower = text.toLowerCase();
    var idx = lower.indexOf(query);
    if (idx === -1) return text.substring(0, 100) + '…';

    var start = Math.max(0, idx - 30);
    var end = Math.min(text.length, idx + query.length + 60);
    var snippet = text.substring(start, end);

    if (start > 0) snippet = '…' + snippet;
    if (end < text.length) snippet = snippet + '…';
    return snippet;
  }

  // ── 渲染結果 ──
  function renderResults(results, query) {
    if (results.length === 0) {
      resultsContainer.innerHTML =
        '<p class="search-no-result">📭 無符合「' + escapeHtml(query) + '」的文件</p>';
      resultsContainer.classList.add('has-results');
      return;
    }

    var html = '<div class="search-stats">找到 ' + results.length + ' 篇相關文件</div>';
    html += '<ul class="search-result-list">';

    // 標題匹配優先
    results.sort(function (a, b) {
      if (a.isTitleMatch && !b.isTitleMatch) return -1;
      if (!a.isTitleMatch && b.isTitleMatch) return 1;
      return 0;
    });

    for (var i = 0; i < results.length; i++) {
      var r = results[i];
      html +=
        '<li class="search-result-item">' +
        '<a href="' + r.url + '" class="search-result-title">' +
        escapeHtml(r.title) + '</a>' +
        '<div class="search-result-meta">' + r.date + '</div>' +
        '<div class="search-result-snippet">' + escapeHtml(r.snippet) + '</div>' +
        '</li>';
    }

    html += '</ul>';
    resultsContainer.innerHTML = html;
    resultsContainer.classList.add('has-results');
  }

  // ── 跳脫 HTML ──
  function escapeHtml(str) {
    var div = document.createElement('div');
    div.appendChild(document.createTextNode(str));
    return div.innerHTML;
  }
})();

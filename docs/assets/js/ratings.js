/**
 * HermesDocs 星等評分 — 篩選、排序、顯示
 * 依賴：ENTRIES 全域變數（由 index.template.html 嵌入）
 */
(function () {
  'use strict';

  var listEl = document.getElementById('doc-list-placeholder');
  var sortSelect = document.getElementById('sort-select');
  var filterGroup = document.getElementById('star-filter-group');
  var currentFilter = 'all';
  var currentSort = 'date-desc';

  if (!listEl || !sortSelect || !filterGroup) return;

  // ── 建立星等篩選按鈕 ──
  function buildFilterButtons() {
    var counts = {};
    for (var i = 0; i < ENTRIES.length; i++) {
      var r = ENTRIES[i].rating || 0;
      counts[r] = (counts[r] || 0) + 1;
    }

    var html = '<button class="star-filter-btn active" data-rating="all">全部 <span class="count">' + ENTRIES.length + '</span></button>';
    for (var s = 5; s >= 1; s--) {
      var c = counts[s] || 0;
      var stars = '';
      for (var k = 0; k < s; k++) stars += '★';
      for (var k = s; k < 5; k++) stars += '☆';
      html += '<button class="star-filter-btn" data-rating="' + s + '">' + stars + ' <span class="count">' + c + '</span></button>';
    }
    // 未評分
    var unrated = counts[0] || 0;
    if (unrated > 0) {
      html += '<button class="star-filter-btn" data-rating="0">未評分 <span class="count">' + unrated + '</span></button>';
    }
    filterGroup.innerHTML = html;

    // 綁定點擊事件
    var btns = filterGroup.querySelectorAll('.star-filter-btn');
    for (var i = 0; i < btns.length; i++) {
      btns[i].addEventListener('click', function () {
        var btns2 = filterGroup.querySelectorAll('.star-filter-btn');
        for (var j = 0; j < btns2.length; j++) btns2[j].classList.remove('active');
        this.classList.add('active');
        currentFilter = this.getAttribute('data-rating');
        renderList();
      });
    }
  }

  // ── 渲染文件列表 ──
  function renderList() {
    // 過濾
    var filtered = [];
    for (var i = 0; i < ENTRIES.length; i++) {
      var e = ENTRIES[i];
      if (currentFilter === 'all' || String(e.rating || 0) === currentFilter) {
        filtered.push(e);
      }
    }

    // 排序
    filtered.sort(function (a, b) {
      switch (currentSort) {
        case 'date-asc':
          return a.mtime - b.mtime;
        case 'date-desc':
          return b.mtime - a.mtime;
        case 'rating-asc':
          return (a.rating || 0) - (b.rating || 0);
        case 'rating-desc':
          return (b.rating || 0) - (a.rating || 0);
        default:
          return b.mtime - a.mtime;
      }
    });

    // 渲染
    if (filtered.length === 0) {
      listEl.innerHTML = '<li class="placeholder">📭 無符合條件的文件</li>';
      return;
    }

    var html = '';
    for (var i = 0; i < filtered.length; i++) {
      var e = filtered[i];
      var dt = new Date(e.mtime * 1000);
      var dateStr = dt.getFullYear() + '-' +
        String(dt.getMonth() + 1).padStart(2, '0') + '-' +
        String(dt.getDate()).padStart(2, '0') + ' ' +
        String(dt.getHours()).padStart(2, '0') + ':' +
        String(dt.getMinutes()).padStart(2, '0');
      var rating = e.rating || 0;
      var stars = '';
      if (rating > 0) {
        for (var k = 0; k < rating; k++) stars += '★';
        for (var k = rating; k < 5; k++) stars += '☆';
      }
      var starHtml = stars ? ' <span class="star-rating">' + stars + '</span>' : '';
      html += '<li>' +
        '<a href="videos/' + e.filename + '">' + escapeHtml(e.title) + '</a>' +
        '<div class="doc-meta">' + dateStr + starHtml + '</div>' +
        '</li>';
    }
    listEl.innerHTML = html;
  }

  // ── 排序變更 ──
  sortSelect.addEventListener('change', function () {
    currentSort = this.value;
    renderList();
  });

  // ── 跳脫 HTML ──
  function escapeHtml(str) {
    var div = document.createElement('div');
    div.appendChild(document.createTextNode(str));
    return div.innerHTML;
  }

  // ── 初始化 ──
  buildFilterButtons();
  renderList();
})();

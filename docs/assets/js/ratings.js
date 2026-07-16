/**
 * HermesDocs 星等評分 — 篩選、排序、顯示、編輯
 *
 * 依賴：ENTRIES 全域變數（由 index.template.html 嵌入）
 * 編輯功能透過 /api/rating POST 寫回 GitHub → Cloudflare Pages 自動重新部署
 */

(function () {
  'use strict';

  var listEl = document.getElementById('doc-list-placeholder');
  var sortSelect = document.getElementById('sort-select');
  var filterGroup = document.getElementById('star-filter-group');
  var currentFilter = 'all';
  var currentSort = 'date-desc';

  if (!listEl || !sortSelect || !filterGroup) return;

  // ── 全域星等快取（從 API 載入後更新） ──
  var liveRatings = {};

  // ── 從 API 載入最新星等 ──
  function loadLiveRatings(callback) {
    var xhr = new XMLHttpRequest();
    xhr.open('GET', '/api/rating', true);
    xhr.onload = function () {
      if (xhr.status === 200) {
        try {
          var data = JSON.parse(xhr.responseText);
          liveRatings = data;
          // 同步到 ENTRIES
          for (var i = 0; i < ENTRIES.length; i++) {
            var f = ENTRIES[i].filename;
            if (liveRatings[f] !== undefined) {
              ENTRIES[i].rating = liveRatings[f];
            }
          }
        } catch (e) {
          console.warn('Failed to parse ratings:', e);
        }
      }
      if (callback) callback();
    };
    xhr.onerror = function () {
      console.warn('Failed to load ratings from API, using embedded data');
      if (callback) callback();
    };
    xhr.send();
  }

  // ── 送出星等更新 ──
  function saveRating(filename, rating, callback) {
    var xhr = new XMLHttpRequest();
    xhr.open('POST', '/api/rating', true);
    xhr.setRequestHeader('Content-Type', 'application/json');
    xhr.onload = function () {
      if (xhr.status === 200) {
        // 更新本地快取
        if (rating === 0) {
          delete liveRatings[filename];
        } else {
          liveRatings[filename] = rating;
        }
        // 同步 ENTRIES
        for (var i = 0; i < ENTRIES.length; i++) {
          if (ENTRIES[i].filename === filename) {
            ENTRIES[i].rating = rating;
            break;
          }
        }
        if (callback) callback(true);
      } else {
        console.error('Failed to save rating:', xhr.status, xhr.responseText);
        if (callback) callback(false);
      }
    };
    xhr.onerror = function () {
      console.error('Network error saving rating');
      if (callback) callback(false);
    };
    xhr.send(JSON.stringify({ filename: filename, rating: rating }));
  }

  // ── 建立星等編輯彈窗 ──
  function showRatingEditor(filename, currentRating, onDone) {
    // 移除舊彈窗
    var old = document.getElementById('rating-editor-overlay');
    if (old) old.remove();

    var overlay = document.createElement('div');
    overlay.id = 'rating-editor-overlay';
    overlay.className = 'rating-editor-overlay';

    var box = document.createElement('div');
    box.className = 'rating-editor-box';

    var title = document.createElement('div');
    title.className = 'rating-editor-title';
    title.textContent = '設定星等';

    var starsRow = document.createElement('div');
    starsRow.className = 'rating-editor-stars';

    for (var s = 1; s <= 5; s++) {
      (function (star) {
        var btn = document.createElement('button');
        btn.className = 'rating-editor-star';
        btn.textContent = star <= currentRating ? '★' : '☆';
        btn.dataset.value = star;
        btn.addEventListener('click', function () {
          // 高亮
          var allBtns = starsRow.querySelectorAll('.rating-editor-star');
          for (var k = 0; k < allBtns.length; k++) {
            allBtns[k].textContent = k < star ? '★' : '☆';
          }
          // 儲存
          saveRating(filename, star, function (ok) {
            if (ok) {
              showToast('✅ 星等已更新，網站重新部署中 (~30-60 秒)');
              if (onDone) onDone(star);
            } else {
              showToast('❌ 更新失敗，請稍後再試');
            }
          });
          overlay.remove();
        });
        starsRow.appendChild(btn);
      })(s);
    }

    // 清除星等按鈕
    var clearBtn = document.createElement('button');
    clearBtn.className = 'rating-editor-clear';
    clearBtn.textContent = '清除星等';
    clearBtn.addEventListener('click', function () {
      saveRating(filename, 0, function (ok) {
        if (ok) {
          showToast('✅ 星等已清除');
          if (onDone) onDone(0);
        } else {
          showToast('❌ 清除失敗，請稍後再試');
        }
      });
      overlay.remove();
    });

    // 關閉按鈕
    var closeBtn = document.createElement('button');
    closeBtn.className = 'rating-editor-close';
    closeBtn.textContent = '✕';
    closeBtn.addEventListener('click', function () { overlay.remove(); });

    box.appendChild(closeBtn);
    box.appendChild(title);
    box.appendChild(starsRow);
    box.appendChild(clearBtn);
    overlay.appendChild(box);

    // 點擊 overlay 背景關閉
    overlay.addEventListener('click', function (e) {
      if (e.target === overlay) overlay.remove();
    });

    document.body.appendChild(overlay);
  }

  // ── Toast 通知 ──
  function showToast(msg) {
    var old = document.getElementById('rating-toast');
    if (old) old.remove();

    var toast = document.createElement('div');
    toast.id = 'rating-toast';
    toast.className = 'rating-toast';
    toast.textContent = msg;
    document.body.appendChild(toast);

    setTimeout(function () {
      if (toast.parentNode) toast.parentNode.removeChild(toast);
    }, 5000);
  }

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
        '<div class="doc-meta">' + dateStr + starHtml +
        ' <button class="rating-edit-btn" data-filename="' + e.filename + '" data-rating="' + rating + '" title="設定星等">✎</button>' +
        '</div></li>';
    }
    listEl.innerHTML = html;

    // 綁定編輯按鈕
    var editBtns = listEl.querySelectorAll('.rating-edit-btn');
    for (var i = 0; i < editBtns.length; i++) {
      (function (btn) {
        btn.addEventListener('click', function (e) {
          e.preventDefault();
          var filename = btn.getAttribute('data-filename');
          var currentRating = parseInt(btn.getAttribute('data-rating')) || 0;
          showRatingEditor(filename, currentRating, function (newRating) {
            // 更新按鈕的 data-rating
            btn.setAttribute('data-rating', String(newRating));
            // 重新渲染列表
            loadLiveRatings(function () {
              buildFilterButtons();
              renderList();
            });
          });
        });
      })(editBtns[i]);
    }
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
  // 先從 API 載入最新星等，再建立 UI
  loadLiveRatings(function () {
    buildFilterButtons();
    renderList();
  });
})();

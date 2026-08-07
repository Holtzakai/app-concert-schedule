import {
  calculateGpSchedule,
  calculateMainSchedule,
  createItem,
  formatTime,
  ITEM_TYPES,
  resolveGpItems,
  scheduleEnd,
} from "./domain/schedule.js";
import { createSampleState } from "./domain/sample.js";
import { parseProjectJson, serializeProject } from "./domain/project.js";
import { createSchedulePdf } from "./export/pdf.js";
import { createScheduleXlsx } from "./export/xlsx.js";

const STORAGE_KEY = "soutei-concert-schedule-v1";
const numericSettings = new Set(["tuningMinutes", "travelMinutes"]);
const numericItemFields = new Set(["durationMinutes", "prepMinutes", "gapAfter"]);
const app = {
  state: loadState(),
  saveTimer: null,
};

function loadState() {
  try {
    const saved = JSON.parse(localStorage.getItem(STORAGE_KEY));
    if (saved?.settings && Array.isArray(saved.items)) {
      const defaults = createSampleState();
      if (saved.schemaVersion !== 2 && saved.settings.organization === "相模原中等教育学校吹奏楽部") {
        saved.settings.organization = "〇〇学校吹奏楽部";
      }
      return {
        ...saved,
        schemaVersion: 2,
        settings: { ...defaults.settings, ...saved.settings },
        gpOrder: Array.isArray(saved.gpOrder) ? saved.gpOrder : [],
        activeView: saved.activeView || "main",
      };
    }
  } catch {
    localStorage.removeItem(STORAGE_KEY);
  }
  return createSampleState();
}

function saveState() {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(app.state));
  const status = document.querySelector("#save-status");
  status.textContent = "保存しました";
  clearTimeout(app.saveTimer);
  app.saveTimer = setTimeout(() => {
    status.textContent = "この端末に自動保存";
  }, 1600);
}

function escapeHtml(value) {
  return String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function typeLabel(type) {
  return type === ITEM_TYPES.PERFORMANCE ? "演奏" : type === ITEM_TYPES.BREAK ? "休憩" : "進行";
}

function renderSettings() {
  document.querySelectorAll("[data-setting]").forEach((input) => {
    input.value = app.state.settings[input.dataset.setting] ?? "";
  });
}

function selectOptions(current, values) {
  return values.map((value) => `<option value="${escapeHtml(value)}"${value === current ? " selected" : ""}>${escapeHtml(value)}</option>`).join("");
}

function renderItems() {
  const schedule = calculateMainSchedule(app.state.settings, app.state.items);
  const list = document.querySelector("#item-list");
  list.innerHTML = schedule.map((item, index) => {
    const performance = item.type === ITEM_TYPES.PERFORMANCE;
    const itemTime = performance ? formatTime(item.start) : `${formatTime(item.start)}–${formatTime(item.end)}`;
    return `
      <article class="item-card item-${item.type}" data-id="${item.id}">
        <div class="item-order">
          <span class="item-number">${performance ? String(item.sequence).padStart(2, "0") : typeLabel(item.type)}</span>
          <strong>${itemTime}</strong>
        </div>
        <div class="item-fields">
          <label class="field compact-field item-type-field">
            <span>区分</span>
            <select data-item-field="type">${selectOptions(item.type, [ITEM_TYPES.PERFORMANCE, ITEM_TYPES.BREAK, ITEM_TYPES.CUE]).replace(">performance<", ">演奏<").replace(">break<", ">休憩<").replace(">cue<", ">進行<")}</select>
          </label>
          <label class="field compact-field item-name-field">
            <span>内容・団体編成</span>
            <input data-item-field="name" type="text" value="${escapeHtml(item.name)}" />
          </label>
          <label class="field compact-field">
            <span>所要</span>
            <span class="number-suffix"><input data-item-field="durationMinutes" type="number" min="0" max="180" value="${item.durationMinutes}" /><small>分</small></span>
          </label>
          <label class="field compact-field ${performance ? "" : "is-muted"}">
            <span>袖待機</span>
            <span class="number-suffix"><input data-item-field="prepMinutes" type="number" min="0" max="30" value="${item.prepMinutes}" ${performance ? "" : "disabled"} /><small>分</small></span>
          </label>
          <label class="field compact-field">
            <span>次まで</span>
            <span class="number-suffix"><input data-item-field="gapAfter" type="number" min="0" max="60" value="${item.gapAfter}" /><small>分</small></span>
          </label>
          <label class="field compact-field ${performance ? "" : "is-muted"}">
            <span>部屋</span>
            <input data-item-field="room" type="text" value="${escapeHtml(item.room)}" ${performance ? "" : "disabled"} />
          </label>
          <label class="field compact-field announcement-field">
            <span>影アナ</span>
            <input data-item-field="announcement" type="text" value="${escapeHtml(item.announcement)}" />
          </label>
          <details class="lighting-details">
            <summary>照明</summary>
            <div class="lighting-fields">
              <label>ステージ<select data-item-field="stageLight">${selectOptions(item.stageLight, ["明", "暗", "─"])}</select></label>
              <label>スポット<select data-item-field="spotLight">${selectOptions(item.spotLight, ["×", "○", "─"])}</select></label>
              <label>客席<select data-item-field="audienceLight">${selectOptions(item.audienceLight, ["明", "暗", "─"])}</select></label>
            </div>
          </details>
        </div>
        <div class="item-actions" aria-label="${escapeHtml(item.name)}の操作">
          <button data-move="up" type="button" aria-label="上へ移動" ${index === 0 ? "disabled" : ""}>↑</button>
          <button data-move="down" type="button" aria-label="下へ移動" ${index === schedule.length - 1 ? "disabled" : ""}>↓</button>
          <button data-delete type="button" aria-label="削除">削除</button>
        </div>
      </article>`;
  }).join("");
}

function renderGpOrder() {
  const items = resolveGpItems(app.state.items, app.state.gpOrder);
  const schedule = calculateGpSchedule(app.state.settings, app.state.items, app.state.gpOrder);
  const list = document.querySelector("#gp-order-list");
  if (items.length === 0) {
    list.innerHTML = '<p class="empty-message">演奏項目を追加すると、ここにGP曲順が表示されます。</p>';
    return;
  }
  list.innerHTML = items.map((item, index) => `
    <div class="gp-order-item" data-gp-id="${item.id}">
      <span class="gp-order-number">${String(index + 1).padStart(2, "0")}</span>
      <strong>${escapeHtml(item.name)}</strong>
      <span class="gp-order-time">${formatTime(schedule[index].start)}</span>
      <div class="gp-order-actions">
        <button data-gp-move="up" type="button" aria-label="${escapeHtml(item.name)}を上へ" ${index === 0 ? "disabled" : ""}>↑</button>
        <button data-gp-move="down" type="button" aria-label="${escapeHtml(item.name)}を下へ" ${index === items.length - 1 ? "disabled" : ""}>↓</button>
      </div>
    </div>`).join("");
}

function formatDate(value) {
  if (!value) return "日付未設定";
  const date = new Date(`${value}T00:00:00`);
  if (Number.isNaN(date.getTime())) return value;
  return new Intl.DateTimeFormat("ja-JP", { month: "2-digit", day: "2-digit", weekday: "short" }).format(date);
}

function performanceRow(item) {
  return `<tr>
    <td class="cell-center">${item.sequence}</td>
    <td>${escapeHtml(item.name)}</td>
    <td class="cell-time">${formatTime(item.tuningStart)}</td>
    <td class="cell-time">${formatTime(item.tuningEnd)}</td>
    <td class="cell-center">${escapeHtml(item.room || "─")}</td>
    <td class="cell-time">${formatTime(item.sleeve)}</td>
    <td class="cell-time is-primary-time">${formatTime(item.start)}</td>
    <td class="cell-time">${formatTime(item.end)}</td>
    <td class="cell-center">${escapeHtml(item.stageLight)}</td>
    <td class="cell-center">${escapeHtml(item.spotLight)}</td>
    <td class="cell-center">${escapeHtml(item.audienceLight)}</td>
    <td>${escapeHtml(item.announcement)}</td>
  </tr>`;
}

function specialRow(item) {
  const timeText = item.type === ITEM_TYPES.BREAK
    ? `${item.name} ${item.durationMinutes}分間（${formatTime(item.start)}〜${formatTime(item.end)}）${item.gapAfter ? `　次の開演まで${item.gapAfter}分確保` : ""}`
    : `${item.name}（${formatTime(item.start)}）`;
  return `<tr class="special-row special-${item.type}">
    <td colspan="8">${escapeHtml(timeText)}</td>
    <td class="cell-center">${escapeHtml(item.stageLight)}</td>
    <td class="cell-center">${escapeHtml(item.spotLight)}</td>
    <td class="cell-center">${escapeHtml(item.audienceLight)}</td>
    <td>${escapeHtml(item.announcement)}</td>
  </tr>`;
}

function portraitPerformanceRow(item) {
  return `<tr>
    <td class="cell-center">${item.sequence}</td>
    <td>${escapeHtml(item.name)}</td>
    <td class="portrait-stacked"><strong>${formatTime(item.tuningStart)}–${formatTime(item.tuningEnd)}</strong><small>${escapeHtml(item.room || "─")}</small></td>
    <td class="cell-time">${formatTime(item.sleeve)}</td>
    <td class="portrait-stacked"><strong>${formatTime(item.start)}–${formatTime(item.end)}</strong><small>${item.durationMinutes}分</small></td>
    <td class="portrait-stacked"><strong>${escapeHtml(`${item.stageLight}／${item.spotLight}／${item.audienceLight}`)}</strong><small>舞／スポ／客</small></td>
    <td>${escapeHtml(item.announcement)}</td>
  </tr>`;
}

function portraitSpecialRow(item) {
  const timeText = item.type === ITEM_TYPES.BREAK
    ? `${item.name} ${item.durationMinutes}分間（${formatTime(item.start)}〜${formatTime(item.end)}）${item.gapAfter ? `　次まで${item.gapAfter}分` : ""}`
    : `${item.name}（${formatTime(item.start)}）`;
  return `<tr class="special-row special-${item.type}">
    <td colspan="5">${escapeHtml(timeText)}</td>
    <td class="cell-center">${escapeHtml(`${item.stageLight}／${item.spotLight}／${item.audienceLight}`)}</td>
    <td>${escapeHtml(item.announcement)}</td>
  </tr>`;
}

function renderPreview() {
  const { settings } = app.state;
  const isGp = app.state.activeView === "gp";
  const portrait = settings.layoutOrientation === "portrait";
  const schedule = isGp
    ? calculateGpSchedule(settings, app.state.items, app.state.gpOrder)
    : calculateMainSchedule(settings, app.state.items);
  const end = scheduleEnd(schedule, isGp ? settings.gpStart : settings.firstStart);
  const title = isGp ? settings.title.replace(/進行表$/, "GP進行表") : settings.title;
  const meta = isGp
    ? `${formatDate(settings.date)}　於 ${settings.venue}　GP ${settings.gpStart}〜${formatTime(end)}`
    : `${formatDate(settings.date)}　於 ${settings.venue}　開場 ${settings.doorsOpen}／開演 ${settings.firstStart}／終演 ${formatTime(end)}`;
  const landscapeLeadRows = isGp ? "" : `
    <tr class="special-row"><td colspan="8">開場（${escapeHtml(settings.doorsOpen)}）</td><td class="cell-center">暗</td><td class="cell-center">×</td><td class="cell-center">明</td><td>（予ベル）挨拶・鑑賞上の注意事項</td></tr>
    <tr class="special-row"><td colspan="8">開演の挨拶（${escapeHtml(settings.openingCue)}）放送にて</td><td class="cell-center">暗</td><td class="cell-center">×</td><td class="cell-center">暗</td><td>（本ベル）開演挨拶</td></tr>`;
  const portraitLeadRows = isGp ? "" : `
    <tr class="special-row"><td colspan="5">開場（${escapeHtml(settings.doorsOpen)}）</td><td class="cell-center">暗／×／明</td><td>（予ベル）挨拶・鑑賞上の注意事項</td></tr>
    <tr class="special-row"><td colspan="5">開演の挨拶（${escapeHtml(settings.openingCue)}）放送にて</td><td class="cell-center">暗／×／暗</td><td>（本ベル）開演挨拶</td></tr>`;
  const tableMarkup = portrait ? `
      <table class="schedule-table portrait-table">
        <colgroup><col class="p-col-order" /><col class="p-col-name" /><col class="p-col-tuning" /><col class="p-col-sleeve" /><col class="p-col-performance" /><col class="p-col-light" /><col class="p-col-announce" /></colgroup>
        <thead><tr><th>順</th><th>団体編成</th><th>チューニング<br><small>開始–終了／部屋</small></th><th>ステージ袖</th><th>演奏<br><small>開始–終了</small></th><th>照明<br><small>舞／スポ／客</small></th><th>影アナ</th></tr></thead>
        <tbody>${portraitLeadRows}${schedule.map((item) => item.type === ITEM_TYPES.PERFORMANCE ? portraitPerformanceRow(item) : portraitSpecialRow(item)).join("")}</tbody>
      </table>` : `
      <table class="schedule-table">
        <colgroup>
          <col class="col-order" /><col class="col-name" /><col class="col-time" /><col class="col-time" />
          <col class="col-room" /><col class="col-time" /><col class="col-time" /><col class="col-time" />
          <col class="col-light" /><col class="col-light" /><col class="col-light" /><col class="col-announce" />
        </colgroup>
        <thead>
          <tr><th rowspan="2">順</th><th rowspan="2">団体編成</th><th colspan="3">チューニング（${settings.tuningMinutes}分間）</th><th rowspan="2">ステージ袖</th><th rowspan="2">演奏開始</th><th rowspan="2">演奏終了</th><th colspan="3">照明</th><th rowspan="2">影アナ</th></tr>
          <tr><th>開始</th><th>終了</th><th>部屋</th><th>ステージ</th><th>スポット</th><th>客席</th></tr>
        </thead>
        <tbody>${landscapeLeadRows}${schedule.map((item) => item.type === ITEM_TYPES.PERFORMANCE ? performanceRow(item) : specialRow(item)).join("")}</tbody>
      </table>`;

  const paper = document.querySelector("#schedule-paper");
  paper.classList.toggle("is-portrait", portrait);
  paper.innerHTML = `
    <div class="paper-heading">
      <div class="paper-titles"><p>${escapeHtml(settings.organization)}</p><h3>${escapeHtml(title)}</h3></div>
      <p class="paper-meta">${escapeHtml(meta)}</p>
    </div>
    <div class="schedule-table-wrap">
      ${tableMarkup}
    </div>`;

  document.querySelectorAll("[data-view]").forEach((button) => {
    const active = button.dataset.view === app.state.activeView;
    button.classList.toggle("is-active", active);
    button.setAttribute("aria-selected", String(active));
  });
  document.querySelectorAll("[data-orientation]").forEach((button) => {
    const active = button.dataset.orientation === settings.layoutOrientation;
    button.classList.toggle("is-active", active);
    button.setAttribute("aria-pressed", String(active));
  });
}

function render() {
  renderSettings();
  renderItems();
  renderGpOrder();
  renderPreview();
}

function updateItem(id, field, rawValue, rerenderItems = false) {
  const item = app.state.items.find((candidate) => candidate.id === id);
  if (!item) return;
  const value = numericItemFields.has(field) ? Number(rawValue) : rawValue;
  if (field === "type" && item.type !== value) {
    const defaults = createItem(value, { id: item.id, name: item.name });
    Object.assign(item, defaults);
  } else {
    item[field] = value;
  }
  saveState();
  if (rerenderItems) renderItems();
  renderGpOrder();
  renderPreview();
}

function moveItem(id, direction) {
  const index = app.state.items.findIndex((item) => item.id === id);
  const target = direction === "up" ? index - 1 : index + 1;
  if (index < 0 || target < 0 || target >= app.state.items.length) return;
  [app.state.items[index], app.state.items[target]] = [app.state.items[target], app.state.items[index]];
  saveState();
  renderItems();
  renderGpOrder();
  renderPreview();
}

function moveGpItem(id, direction) {
  const ordered = resolveGpItems(app.state.items, app.state.gpOrder).map((item) => item.id);
  const index = ordered.indexOf(id);
  const target = direction === "up" ? index - 1 : index + 1;
  if (index < 0 || target < 0 || target >= ordered.length) return;
  [ordered[index], ordered[target]] = [ordered[target], ordered[index]];
  app.state.gpOrder = ordered;
  saveState();
  renderGpOrder();
  renderPreview();
}

function showToast(message) {
  const toast = document.querySelector("#toast");
  toast.textContent = message;
  toast.classList.add("is-visible");
  setTimeout(() => toast.classList.remove("is-visible"), 2200);
}

function downloadBlob(blob, filename) {
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  document.body.append(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
}

function safeFilename(value, fallback = "進行表") {
  return String(value || fallback).replaceAll(/[\\/:*?"<>|]/g, "_");
}

document.addEventListener("input", (event) => {
  const setting = event.target.closest("[data-setting]");
  if (setting) {
    const key = setting.dataset.setting;
    app.state.settings[key] = numericSettings.has(key) ? Number(setting.value) : setting.value;
    saveState();
    renderItems();
    renderGpOrder();
    renderPreview();
    return;
  }
  const itemInput = event.target.closest("[data-item-field]");
  if (itemInput && itemInput.tagName !== "SELECT") {
    updateItem(itemInput.closest("[data-id]").dataset.id, itemInput.dataset.itemField, itemInput.value);
  }
});

document.addEventListener("change", (event) => {
  const itemInput = event.target.closest("[data-item-field]");
  if (itemInput) updateItem(itemInput.closest("[data-id]").dataset.id, itemInput.dataset.itemField, itemInput.value, true);
});

document.addEventListener("click", (event) => {
  const addButton = event.target.closest("[data-add]");
  if (addButton) {
    app.state.items.push(createItem(addButton.dataset.add));
    saveState();
    renderItems();
    renderGpOrder();
    renderPreview();
    document.querySelector("#item-list").lastElementChild?.scrollIntoView({ behavior: "smooth", block: "nearest" });
    return;
  }
  const viewButton = event.target.closest("[data-view]");
  if (viewButton) {
    app.state.activeView = viewButton.dataset.view;
    saveState();
    renderPreview();
    return;
  }
  const orientationButton = event.target.closest("[data-orientation]");
  if (orientationButton) {
    app.state.settings.layoutOrientation = orientationButton.dataset.orientation;
    saveState();
    renderPreview();
    return;
  }
  const gpMoveButton = event.target.closest("[data-gp-move]");
  if (gpMoveButton) {
    moveGpItem(gpMoveButton.closest("[data-gp-id]").dataset.gpId, gpMoveButton.dataset.gpMove);
    return;
  }
  const card = event.target.closest("[data-id]");
  if (!card) return;
  const moveButton = event.target.closest("[data-move]");
  if (moveButton) moveItem(card.dataset.id, moveButton.dataset.move);
  if (event.target.closest("[data-delete]")) {
    app.state.items = app.state.items.filter((item) => item.id !== card.dataset.id);
    app.state.gpOrder = app.state.gpOrder.filter((id) => id !== card.dataset.id);
    saveState();
    renderItems();
    renderGpOrder();
    renderPreview();
  }
});

document.querySelector("#gp-order-reset").addEventListener("click", () => {
  app.state.gpOrder = [];
  saveState();
  renderGpOrder();
  renderPreview();
  showToast("GP曲順を本番の逆順に戻しました");
});

document.querySelector("#print-button").addEventListener("click", async (event) => {
  const button = event.currentTarget;
  const original = button.textContent;
  button.disabled = true;
  button.textContent = "PDFを作成中…";
  try {
    const kind = app.state.activeView === "gp" ? "gp" : "main";
    const suffix = kind === "gp" ? "_GP" : "";
    downloadBlob(await createSchedulePdf(app.state, kind), `${safeFilename(app.state.settings.title)}${suffix}.pdf`);
    showToast(`${kind === "gp" ? "GP" : "本番"}進行表のPDFを出力しました`);
  } catch (error) {
    console.error(error);
    showToast("PDFを作成できませんでした。入力内容をご確認ください。");
  } finally {
    button.disabled = false;
    button.textContent = original;
  }
});
document.querySelector("#excel-button").addEventListener("click", () => {
  downloadBlob(createScheduleXlsx(app.state), `${safeFilename(app.state.settings.title)}.xlsx`);
  showToast("本番・GP・入力データの3シートを出力しました");
});
document.querySelector("#json-save-button").addEventListener("click", () => {
  const blob = new Blob([serializeProject(app.state)], { type: "application/json;charset=utf-8" });
  downloadBlob(blob, `${safeFilename(app.state.settings.title)}_中間データ.json`);
  showToast("中間データをJSONで保存しました");
});
document.querySelector("#json-load-button").addEventListener("click", () => {
  document.querySelector("#json-file-input").click();
});
document.querySelector("#json-file-input").addEventListener("change", async (event) => {
  const input = event.currentTarget;
  const file = input.files?.[0];
  if (!file) return;
  try {
    const imported = parseProjectJson(await file.text());
    if (!window.confirm(`「${imported.settings.title}」を読み込み、現在の入力内容を置き換えますか？`)) return;
    app.state = imported;
    saveState();
    render();
    showToast("中間データを読み込みました");
  } catch (error) {
    showToast(error instanceof Error ? error.message : "JSONを読み込めませんでした。");
  } finally {
    input.value = "";
  }
});
document.querySelector("#reset-button").addEventListener("click", () => {
  if (!window.confirm("入力内容をサンプルに戻しますか？")) return;
  app.state = createSampleState();
  saveState();
  render();
});

render();

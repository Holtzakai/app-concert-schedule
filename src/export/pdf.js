import { calculateGpSchedule, calculateMainSchedule, formatTime, ITEM_TYPES, scheduleEnd } from "../domain/schedule.js";

const LANDSCAPE = { pageWidth: 1684, pageHeight: 1191, pdfWidth: 841.89, pdfHeight: 595.28 };
const PORTRAIT = { pageWidth: 1191, pageHeight: 1684, pdfWidth: 595.28, pdfHeight: 841.89 };
const encoder = new TextEncoder();

function dateLabel(value) {
  if (!value) return "日付未設定";
  const date = new Date(`${value}T00:00:00`);
  if (Number.isNaN(date.getTime())) return value;
  return new Intl.DateTimeFormat("ja-JP", { month: "2-digit", day: "2-digit", weekday: "short" }).format(date);
}

function fitText(ctx, text, maxWidth, baseSize = 20, minSize = 11) {
  const value = String(text ?? "");
  let size = baseSize;
  while (size > minSize) {
    ctx.font = `${size}px "Yu Gothic", "Hiragino Kaku Gothic ProN", sans-serif`;
    if (ctx.measureText(value).width <= maxWidth) break;
    size -= 1;
  }
  if (ctx.measureText(value).width <= maxWidth) return value;
  let clipped = value;
  while (clipped && ctx.measureText(`${clipped}…`).width > maxWidth) clipped = clipped.slice(0, -1);
  return `${clipped}…`;
}

function drawCell(ctx, x, y, width, height, text, options = {}) {
  const { align = "center", fill = "#ffffff", bold = false, size = 20 } = options;
  ctx.fillStyle = fill;
  ctx.fillRect(x, y, width, height);
  ctx.strokeStyle = "#111111";
  ctx.lineWidth = 2;
  ctx.strokeRect(x, y, width, height);
  ctx.save();
  ctx.beginPath();
  ctx.rect(x + 3, y + 2, width - 6, height - 4);
  ctx.clip();
  ctx.fillStyle = "#111111";
  ctx.textBaseline = "middle";
  ctx.textAlign = align;
  ctx.font = `${bold ? "700" : "400"} ${size}px "Yu Gothic", "Hiragino Kaku Gothic ProN", sans-serif`;
  const display = fitText(ctx, text, width - 12, size, 10);
  ctx.fillText(display, align === "left" ? x + 7 : align === "right" ? x + width - 7 : x + width / 2, y + height / 2 + 1);
  ctx.restore();
}

const landscapeWidths = [55, 320, 105, 105, 65, 105, 105, 105, 65, 65, 65, 416];
const portraitWidths = [50, 225, 190, 95, 150, 95, 270];

function drawLandscapeHeader(ctx, x, y) {
  const h = 42;
  let cursor = x;
  drawCell(ctx, cursor, y, landscapeWidths[0], h * 2, "順", { fill: "#e8eae7", bold: true }); cursor += landscapeWidths[0];
  drawCell(ctx, cursor, y, landscapeWidths[1], h * 2, "団体編成", { fill: "#e8eae7", bold: true }); cursor += landscapeWidths[1];
  drawCell(ctx, cursor, y, landscapeWidths[2] + landscapeWidths[3] + landscapeWidths[4], h, "チューニング", { fill: "#e8eae7", bold: true });
  let subCursor = cursor;
  ["開始", "終了", "部屋"].forEach((label, index) => {
    drawCell(ctx, subCursor, y + h, landscapeWidths[index + 2], h, label, { fill: "#f3f4f2", size: 18 });
    subCursor += landscapeWidths[index + 2];
  });
  cursor += landscapeWidths[2] + landscapeWidths[3] + landscapeWidths[4];
  ["ステージ袖", "演奏開始", "演奏終了"].forEach((label, index) => {
    drawCell(ctx, cursor, y, landscapeWidths[index + 5], h * 2, label, { fill: "#e8eae7", bold: true, size: 18 });
    cursor += landscapeWidths[index + 5];
  });
  drawCell(ctx, cursor, y, landscapeWidths[8] + landscapeWidths[9] + landscapeWidths[10], h, "照明", { fill: "#e8eae7", bold: true });
  subCursor = cursor;
  ["ステージ", "スポット", "客席"].forEach((label, index) => {
    drawCell(ctx, subCursor, y + h, landscapeWidths[index + 8], h, label, { fill: "#f3f4f2", size: 16 });
    subCursor += landscapeWidths[index + 8];
  });
  cursor += landscapeWidths[8] + landscapeWidths[9] + landscapeWidths[10];
  drawCell(ctx, cursor, y, landscapeWidths[11], h * 2, "影アナ", { fill: "#e8eae7", bold: true });
  return y + h * 2;
}

function drawPortraitHeader(ctx, x, y) {
  const labels = ["順", "団体編成", "チューニング\n開始–終了／部屋", "ステージ袖", "演奏\n開始–終了", "照明\n舞／スポ／客", "影アナ"];
  let cursor = x;
  labels.forEach((label, index) => {
    drawCell(ctx, cursor, y, portraitWidths[index], 72, label.replace("\n", " "), { fill: "#e8eae7", bold: true, size: index === 2 || index === 4 || index === 5 ? 15 : 18 });
    cursor += portraitWidths[index];
  });
  return y + 72;
}

function scheduleRows(state, kind) {
  const isGp = kind === "gp";
  const schedule = isGp
    ? calculateGpSchedule(state.settings, state.items, state.gpOrder)
    : calculateMainSchedule(state.settings, state.items);
  const rows = [];
  if (!isGp) {
    rows.push({ type: "special", text: `開場（${state.settings.doorsOpen}）`, stageLight: "暗", spotLight: "×", audienceLight: "明", announcement: "（予ベル）挨拶・鑑賞上の注意事項" });
    rows.push({ type: "special", text: `開演の挨拶（${state.settings.openingCue}）放送にて`, stageLight: "暗", spotLight: "×", audienceLight: "暗", announcement: "（本ベル）開演挨拶" });
  }
  for (const item of schedule) {
    if (item.type === ITEM_TYPES.PERFORMANCE) {
      rows.push({
        type: "performance",
        cells: [item.sequence, item.name, formatTime(item.tuningStart), formatTime(item.tuningEnd), item.room || "─", formatTime(item.sleeve), formatTime(item.start), formatTime(item.end), item.stageLight, item.spotLight, item.audienceLight, item.announcement],
      });
    } else {
      rows.push({
        type: "special",
        text: item.type === ITEM_TYPES.BREAK
          ? `${item.name} ${item.durationMinutes}分間（${formatTime(item.start)}〜${formatTime(item.end)}）${item.gapAfter ? `　次の開演まで${item.gapAfter}分確保` : ""}`
          : `${item.name}（${formatTime(item.start)}）`,
        stageLight: item.stageLight,
        spotLight: item.spotLight,
        audienceLight: item.audienceLight,
        announcement: item.announcement,
        breakRow: item.type === ITEM_TYPES.BREAK,
      });
    }
  }
  return { schedule, rows };
}

function canvasToJpeg(canvas) {
  return new Promise((resolve, reject) => {
    canvas.toBlob(async (blob) => {
      if (!blob) return reject(new Error("PDF画像を作成できませんでした。"));
      resolve(new Uint8Array(await blob.arrayBuffer()));
    }, "image/jpeg", 0.94);
  });
}

async function renderPages(state, kind) {
  const isGp = kind === "gp";
  const portrait = state.settings.layoutOrientation === "portrait";
  const pageSize = portrait ? PORTRAIT : LANDSCAPE;
  const { schedule, rows } = scheduleRows(state, kind);
  const chunks = [];
  const rowsPerPage = portrait ? 24 : 20;
  for (let start = 0; start < rows.length || (rows.length === 0 && start === 0); start += rowsPerPage) {
    const pageRows = rows.slice(start, start + rowsPerPage);
    const canvas = document.createElement("canvas");
    canvas.width = pageSize.pageWidth;
    canvas.height = pageSize.pageHeight;
    const ctx = canvas.getContext("2d");
    ctx.fillStyle = "#ffffff";
    ctx.fillRect(0, 0, pageSize.pageWidth, pageSize.pageHeight);

    const x = portrait ? 58 : 54;
    const titleX = x;
    ctx.fillStyle = "#111111";
    ctx.font = `700 ${portrait ? 27 : 31}px "Yu Gothic", "Hiragino Kaku Gothic ProN", sans-serif`;
    ctx.fillText(state.settings.organization, titleX, 53);
    ctx.font = `700 ${portrait ? 34 : 41}px "Yu Gothic", "Hiragino Kaku Gothic ProN", sans-serif`;
    const title = isGp ? state.settings.title.replace(/進行表$/, "GP進行表") : state.settings.title;
    ctx.fillText(`${title}${start ? `（続き ${Math.floor(start / rowsPerPage) + 1}）` : ""}`, titleX, 101);

    const end = scheduleEnd(schedule, isGp ? state.settings.gpStart : state.settings.firstStart);
    const meta = isGp
      ? `${dateLabel(state.settings.date)}　於 ${state.settings.venue}　GP ${state.settings.gpStart}〜${formatTime(end)}`
      : `${dateLabel(state.settings.date)}　於 ${state.settings.venue}　開場 ${state.settings.doorsOpen}／開演 ${state.settings.firstStart}／終演 ${formatTime(end)}`;
    ctx.textAlign = "right";
    ctx.font = `400 ${portrait ? 17 : 21}px "Yu Gothic", sans-serif`;
    ctx.fillText(meta, pageSize.pageWidth - x, 126);
    ctx.textAlign = "left";

    let y = portrait ? drawPortraitHeader(ctx, x, 150) : drawLandscapeHeader(ctx, x, 142);
    const rowHeight = portrait ? 56 : 43;
    for (const row of pageRows) {
      let cursor = x;
      if (portrait && row.type === "special") {
        const mergedWidth = portraitWidths.slice(0, 5).reduce((sum, value) => sum + value, 0);
        drawCell(ctx, cursor, y, mergedWidth, rowHeight, row.text, { fill: row.breakRow ? "#f2eee2" : "#f7f7f5", bold: true, size: 17 });
        cursor += mergedWidth;
        drawCell(ctx, cursor, y, portraitWidths[5], rowHeight, `${row.stageLight}／${row.spotLight}／${row.audienceLight}`, { size: 16 });
        cursor += portraitWidths[5];
        drawCell(ctx, cursor, y, portraitWidths[6], rowHeight, row.announcement, { align: "left", size: 16 });
      } else if (portrait) {
        const cells = [
          row.cells[0], row.cells[1], `${row.cells[2]}–${row.cells[3]}／${row.cells[4]}`,
          row.cells[5], `${row.cells[6]}–${row.cells[7]}`,
          `${row.cells[8]}／${row.cells[9]}／${row.cells[10]}`, row.cells[11],
        ];
        cells.forEach((value, index) => {
          drawCell(ctx, cursor, y, portraitWidths[index], rowHeight, value, { align: index === 1 || index === 6 ? "left" : "center", bold: index === 4, size: index === 6 ? 15 : 17 });
          cursor += portraitWidths[index];
        });
      } else if (row.type === "special") {
        const mergedWidth = landscapeWidths.slice(0, 8).reduce((sum, value) => sum + value, 0);
        drawCell(ctx, cursor, y, mergedWidth, rowHeight, row.text, { fill: row.breakRow ? "#f2eee2" : "#f7f7f5", bold: true, size: 19 });
        cursor += mergedWidth;
        [row.stageLight, row.spotLight, row.audienceLight].forEach((value, index) => {
          drawCell(ctx, cursor, y, landscapeWidths[index + 8], rowHeight, value, { size: 19 });
          cursor += landscapeWidths[index + 8];
        });
        drawCell(ctx, cursor, y, landscapeWidths[11], rowHeight, row.announcement, { align: "left", size: 18 });
      } else {
        row.cells.forEach((value, index) => {
          drawCell(ctx, cursor, y, landscapeWidths[index], rowHeight, value, { align: index === 1 || index === 11 ? "left" : "center", bold: index === 6, size: index === 11 ? 17 : 19 });
          cursor += landscapeWidths[index];
        });
      }
      y += rowHeight;
    }
    ctx.textAlign = "right";
    ctx.fillStyle = "#555555";
    ctx.font = '400 16px "Yu Gothic", sans-serif';
    ctx.fillText(`${Math.floor(start / rowsPerPage) + 1} / ${Math.max(1, Math.ceil(rows.length / rowsPerPage))}`, pageSize.pageWidth - x, pageSize.pageHeight - 26);
    chunks.push(await canvasToJpeg(canvas));
    if (rows.length === 0) break;
  }
  return { images: chunks, ...pageSize };
}

function concatBytes(chunks) {
  const length = chunks.reduce((sum, chunk) => sum + chunk.length, 0);
  const result = new Uint8Array(length);
  let offset = 0;
  for (const chunk of chunks) {
    result.set(chunk, offset);
    offset += chunk.length;
  }
  return result;
}

function ascii(value) {
  return encoder.encode(value);
}

export function buildPdfFromJpegs(images, pageSize = LANDSCAPE) {
  const pageIds = images.map((_, index) => 3 + index * 3);
  const objects = new Map();
  objects.set(1, ascii("<< /Type /Catalog /Pages 2 0 R >>"));
  objects.set(2, ascii(`<< /Type /Pages /Count ${images.length} /Kids [${pageIds.map((id) => `${id} 0 R`).join(" ")}] >>`));
  images.forEach((image, index) => {
    const pageId = 3 + index * 3;
    const imageId = pageId + 1;
    const contentId = pageId + 2;
    const imageName = `Im${index + 1}`;
    const content = ascii(`q\n${pageSize.pdfWidth} 0 0 ${pageSize.pdfHeight} 0 0 cm\n/${imageName} Do\nQ`);
    objects.set(pageId, ascii(`<< /Type /Page /Parent 2 0 R /MediaBox [0 0 ${pageSize.pdfWidth} ${pageSize.pdfHeight}] /Resources << /XObject << /${imageName} ${imageId} 0 R >> >> /Contents ${contentId} 0 R >>`));
    objects.set(imageId, concatBytes([
      ascii(`<< /Type /XObject /Subtype /Image /Width ${pageSize.pageWidth} /Height ${pageSize.pageHeight} /ColorSpace /DeviceRGB /BitsPerComponent 8 /Filter /DCTDecode /Length ${image.length} >>\nstream\n`),
      image,
      ascii("\nendstream"),
    ]));
    objects.set(contentId, concatBytes([ascii(`<< /Length ${content.length} >>\nstream\n`), content, ascii("\nendstream")]));
  });

  const header = ascii("%PDF-1.4\n%\xE2\xE3\xCF\xD3\n");
  const chunks = [header];
  const offsets = [0];
  let offset = header.length;
  const count = objects.size;
  for (let id = 1; id <= count; id += 1) {
    const wrapped = concatBytes([ascii(`${id} 0 obj\n`), objects.get(id), ascii("\nendobj\n")]);
    offsets[id] = offset;
    chunks.push(wrapped);
    offset += wrapped.length;
  }
  const xrefOffset = offset;
  const xref = [`xref\n0 ${count + 1}\n`, "0000000000 65535 f \n"];
  for (let id = 1; id <= count; id += 1) xref.push(`${String(offsets[id]).padStart(10, "0")} 00000 n \n`);
  chunks.push(ascii(xref.join("")));
  chunks.push(ascii(`trailer\n<< /Size ${count + 1} /Root 1 0 R >>\nstartxref\n${xrefOffset}\n%%EOF`));
  return new Blob([concatBytes(chunks)], { type: "application/pdf" });
}

export async function createSchedulePdf(state, kind = "main") {
  const rendered = await renderPages(state, kind);
  return buildPdfFromJpegs(rendered.images, rendered);
}

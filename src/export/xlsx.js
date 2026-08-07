import { calculateGpSchedule, calculateMainSchedule, formatTime, ITEM_TYPES, scheduleEnd } from "../domain/schedule.js";

const encoder = new TextEncoder();

function escapeXml(value) {
  return String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&apos;");
}

function columnName(index) {
  let value = index + 1;
  let result = "";
  while (value > 0) {
    value -= 1;
    result = String.fromCharCode(65 + (value % 26)) + result;
    value = Math.floor(value / 26);
  }
  return result;
}

function cellXml(value, row, col) {
  if (value == null) return "";
  const cell = typeof value === "object" ? value : { value };
  const ref = `${columnName(col)}${row + 1}`;
  const style = cell.style != null ? ` s="${cell.style}"` : "";
  if (typeof cell.value === "number") return `<c r="${ref}"${style}><v>${cell.value}</v></c>`;
  return `<c r="${ref}" t="inlineStr"${style}><is><t xml:space="preserve">${escapeXml(cell.value)}</t></is></c>`;
}

function worksheetXml({ rows, merges = [], widths = [], landscape = true, fitToPage = true }) {
  const rowXml = rows
    .map((cells, row) => `<row r="${row + 1}">${cells.map((cell, col) => cellXml(cell, row, col)).join("")}</row>`)
    .join("");
  const cols = widths.length
    ? `<cols>${widths.map((width, index) => `<col min="${index + 1}" max="${index + 1}" width="${width}" customWidth="1"/>`).join("")}</cols>`
    : "";
  const mergeXml = merges.length
    ? `<mergeCells count="${merges.length}">${merges.map((ref) => `<mergeCell ref="${ref}"/>`).join("")}</mergeCells>`
    : "";
  const lastColumn = columnName(Math.max(widths.length, ...rows.map((cells) => cells.length)) - 1);
  const dimension = rows.length ? `A1:${lastColumn}${rows.length}` : "A1";
  return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main">
  <sheetPr>${fitToPage ? '<pageSetUpPr fitToPage="1"/>' : ""}</sheetPr>
  <dimension ref="${dimension}"/>
  <sheetViews><sheetView showGridLines="0" workbookViewId="0"/></sheetViews>
  <sheetFormatPr defaultRowHeight="18"/>
  ${cols}
  <sheetData>${rowXml}</sheetData>
  ${mergeXml}
  <pageMargins left="0.25" right="0.25" top="0.5" bottom="0.5" header="0.2" footer="0.2"/>
  <pageSetup paperSize="9" orientation="${landscape ? "landscape" : "portrait"}" fitToWidth="1" fitToHeight="1"/>
</worksheet>`;
}

const stylesXml = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<styleSheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main">
  <fonts count="4">
    <font><sz val="10"/><name val="Yu Gothic"/><family val="2"/></font>
    <font><b/><sz val="18"/><name val="Yu Gothic"/><family val="2"/></font>
    <font><b/><sz val="14"/><name val="Yu Gothic"/><family val="2"/></font>
    <font><b/><sz val="10"/><name val="Yu Gothic"/><family val="2"/></font>
  </fonts>
  <fills count="4">
    <fill><patternFill patternType="none"/></fill>
    <fill><patternFill patternType="gray125"/></fill>
    <fill><patternFill patternType="solid"><fgColor rgb="FFE8EAE7"/><bgColor indexed="64"/></patternFill></fill>
    <fill><patternFill patternType="solid"><fgColor rgb="FFF2EEE2"/><bgColor indexed="64"/></patternFill></fill>
  </fills>
  <borders count="3">
    <border><left/><right/><top/><bottom/><diagonal/></border>
    <border><left style="thin"><color rgb="FF111111"/></left><right style="thin"><color rgb="FF111111"/></right><top style="thin"><color rgb="FF111111"/></top><bottom style="thin"><color rgb="FF111111"/></bottom><diagonal/></border>
    <border><left style="medium"><color rgb="FF111111"/></left><right style="medium"><color rgb="FF111111"/></right><top style="medium"><color rgb="FF111111"/></top><bottom style="medium"><color rgb="FF111111"/></bottom><diagonal/></border>
  </borders>
  <cellStyleXfs count="1"><xf numFmtId="0" fontId="0" fillId="0" borderId="0"/></cellStyleXfs>
  <cellXfs count="10">
    <xf numFmtId="0" fontId="0" fillId="0" borderId="0" xfId="0"/>
    <xf numFmtId="0" fontId="1" fillId="0" borderId="0" xfId="0" applyAlignment="1"><alignment vertical="center"/></xf>
    <xf numFmtId="0" fontId="2" fillId="0" borderId="0" xfId="0" applyAlignment="1"><alignment vertical="center"/></xf>
    <xf numFmtId="0" fontId="3" fillId="2" borderId="2" xfId="0" applyAlignment="1"><alignment horizontal="center" vertical="center" wrapText="1"/></xf>
    <xf numFmtId="0" fontId="0" fillId="2" borderId="1" xfId="0" applyAlignment="1"><alignment horizontal="center" vertical="center" wrapText="1"/></xf>
    <xf numFmtId="0" fontId="0" fillId="0" borderId="1" xfId="0" applyAlignment="1"><alignment vertical="center" wrapText="1"/></xf>
    <xf numFmtId="0" fontId="0" fillId="0" borderId="1" xfId="0" applyAlignment="1"><alignment horizontal="center" vertical="center"/></xf>
    <xf numFmtId="0" fontId="3" fillId="3" borderId="1" xfId="0" applyAlignment="1"><alignment horizontal="center" vertical="center" wrapText="1"/></xf>
    <xf numFmtId="0" fontId="0" fillId="0" borderId="2" xfId="0" applyAlignment="1"><alignment horizontal="center" vertical="center"/></xf>
    <xf numFmtId="0" fontId="0" fillId="0" borderId="0" xfId="0" applyAlignment="1"><alignment horizontal="right" vertical="center"/></xf>
  </cellXfs>
  <cellStyles count="1"><cellStyle name="Normal" xfId="0" builtinId="0"/></cellStyles>
</styleSheet>`;

function styledBlankCells(count, style) {
  return Array.from({ length: count }, () => ({ value: "", style }));
}

function scheduleRows(state, kind) {
  const isGp = kind === "gp";
  const schedule = isGp
    ? calculateGpSchedule(state.settings, state.items, state.gpOrder)
    : calculateMainSchedule(state.settings, state.items);
  const end = scheduleEnd(schedule, isGp ? state.settings.gpStart : state.settings.firstStart);
  const date = state.settings.date ? new Date(`${state.settings.date}T00:00:00`) : null;
  const dateLabel = date && !Number.isNaN(date.getTime())
    ? new Intl.DateTimeFormat("ja-JP", { month: "2-digit", day: "2-digit", weekday: "short" }).format(date)
    : "日付未設定";
  const rows = [
    [isGp ? { value: "GP", style: 1 } : null, { value: state.settings.organization, style: 1 }, null, null, null, null, null, null, null, null, { value: `${dateLabel}　於 ${state.settings.venue}`, style: 9 }],
    [null, { value: `${isGp ? state.settings.title.replace(/進行表$/, "GP進行表") : state.settings.title}`, style: 2 }, null, null, null, null, null, null, null, null, { value: isGp ? `開始 ${state.settings.gpStart}／終了 ${formatTime(end)}` : `開場 ${state.settings.doorsOpen}／開演 ${state.settings.firstStart}／終演 ${formatTime(end)}`, style: 9 }],
    [],
    [
      { value: "順", style: 3 },
      { value: "団体編成", style: 3 },
      { value: `チューニング（${state.settings.tuningMinutes}分間）`, style: 3 },
      ...styledBlankCells(2, 3),
      { value: "ステージ袖", style: 3 },
      { value: "演奏開始", style: 3 },
      { value: "演奏終了", style: 3 },
      { value: "照明", style: 3 },
      ...styledBlankCells(2, 3),
      { value: "影アナ", style: 3 },
    ],
    [
      ...styledBlankCells(2, 3),
      { value: "開始", style: 4 },
      { value: "終了", style: 4 },
      { value: "部屋", style: 4 },
      ...styledBlankCells(3, 3),
      { value: "ステージ", style: 4 },
      { value: "スポット", style: 4 },
      { value: "客席", style: 4 },
      ...styledBlankCells(1, 3),
    ],
  ];

  if (!isGp) {
    rows.push([
      { value: `開場（${state.settings.doorsOpen}）`, style: 6 },
      ...styledBlankCells(7, 6),
      { value: "暗", style: 6 }, { value: "×", style: 6 }, { value: "明", style: 6 },
      { value: "（予ベル）挨拶・鑑賞上の注意事項", style: 5 },
    ]);
    rows.push([
      { value: `開演の挨拶（${state.settings.openingCue}）`, style: 6 },
      ...styledBlankCells(7, 6),
      { value: "暗", style: 6 }, { value: "×", style: 6 }, { value: "暗", style: 6 },
      { value: "（本ベル）開演挨拶", style: 5 },
    ]);
  }

  for (const item of schedule) {
    if (item.type !== ITEM_TYPES.PERFORMANCE) {
      rows.push([
        { value: `${item.name}${item.type === ITEM_TYPES.BREAK ? ` ${item.durationMinutes}分間（${formatTime(item.start)}〜${formatTime(item.end)}）` : `（${formatTime(item.start)}）`}`, style: 7 },
        ...styledBlankCells(7, 7),
        { value: item.stageLight, style: 6 }, { value: item.spotLight, style: 6 }, { value: item.audienceLight, style: 6 },
        { value: item.announcement, style: 5 },
      ]);
      continue;
    }
    rows.push([
      { value: item.sequence, style: 6 },
      { value: item.name, style: 5 },
      { value: formatTime(item.tuningStart), style: 6 },
      { value: formatTime(item.tuningEnd), style: 6 },
      { value: item.room || "─", style: 6 },
      { value: formatTime(item.sleeve), style: 6 },
      { value: formatTime(item.start), style: 6 },
      { value: formatTime(item.end), style: 6 },
      { value: item.stageLight, style: 6 },
      { value: item.spotLight, style: 6 },
      { value: item.audienceLight, style: 6 },
      { value: item.announcement, style: 5 },
    ]);
  }

  const dataStart = isGp ? 6 : 8;
  const merges = ["B1:J1", "B2:J2", "C4:E4", "I4:K4", "A4:A5", "B4:B5", "F4:F5", "G4:G5", "H4:H5", "L4:L5"];
  if (!isGp) merges.push("A6:H6", "A7:H7");
  for (let row = dataStart; row <= rows.length; row += 1) {
    const source = schedule[row - dataStart];
    if (source && source.type !== ITEM_TYPES.PERFORMANCE) merges.push(`A${row}:H${row}`);
  }
  return { rows, merges };
}

function inputRows(state) {
  const rows = [
    [{ value: "入力データ", style: 1 }],
    ["区分", "内容・団体編成", "所要時間(分)", "袖待機(分)", "次までの間隔(分)", "部屋", "ステージ", "スポット", "客席", "影アナ"].map((value) => ({ value, style: 3 })),
  ];
  state.items.forEach((item) => {
    rows.push([
      { value: item.type === "performance" ? "演奏" : item.type === "break" ? "休憩" : "進行", style: 6 },
      { value: item.name, style: 5 },
      { value: Number(item.durationMinutes), style: 6 },
      { value: Number(item.prepMinutes), style: 6 },
      { value: Number(item.gapAfter), style: 6 },
      { value: item.room, style: 6 },
      { value: item.stageLight, style: 6 },
      { value: item.spotLight, style: 6 },
      { value: item.audienceLight, style: 6 },
      { value: item.announcement, style: 5 },
    ]);
  });
  return { rows, merges: ["A1:J1"] };
}

function crcTable() {
  const table = new Uint32Array(256);
  for (let n = 0; n < 256; n += 1) {
    let c = n;
    for (let k = 0; k < 8; k += 1) c = (c & 1) ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    table[n] = c >>> 0;
  }
  return table;
}

const CRC_TABLE = crcTable();
const ZIP_DOS_DATE = 0x0021;

function crc32(bytes) {
  let crc = 0xffffffff;
  for (const byte of bytes) crc = CRC_TABLE[(crc ^ byte) & 0xff] ^ (crc >>> 8);
  return (crc ^ 0xffffffff) >>> 0;
}

function u16(value) {
  return new Uint8Array([value & 0xff, (value >>> 8) & 0xff]);
}

function u32(value) {
  return new Uint8Array([value & 0xff, (value >>> 8) & 0xff, (value >>> 16) & 0xff, (value >>> 24) & 0xff]);
}

function concat(chunks) {
  const size = chunks.reduce((total, chunk) => total + chunk.length, 0);
  const result = new Uint8Array(size);
  let offset = 0;
  for (const chunk of chunks) {
    result.set(chunk, offset);
    offset += chunk.length;
  }
  return result;
}

function zipStore(files) {
  const local = [];
  const central = [];
  let offset = 0;
  for (const [name, content] of Object.entries(files)) {
    const nameBytes = encoder.encode(name);
    const data = typeof content === "string" ? encoder.encode(content) : content;
    const crc = crc32(data);
    const localHeader = concat([
      u32(0x04034b50), u16(20), u16(0x0800), u16(0), u16(0), u16(ZIP_DOS_DATE),
      u32(crc), u32(data.length), u32(data.length), u16(nameBytes.length), u16(0), nameBytes,
    ]);
    local.push(localHeader, data);
    central.push(concat([
      u32(0x02014b50), u16(20), u16(20), u16(0x0800), u16(0), u16(0), u16(ZIP_DOS_DATE),
      u32(crc), u32(data.length), u32(data.length), u16(nameBytes.length), u16(0), u16(0),
      u16(0), u16(0), u32(0), u32(offset), nameBytes,
    ]));
    offset += localHeader.length + data.length;
  }
  const centralBytes = concat(central);
  const end = concat([
    u32(0x06054b50), u16(0), u16(0), u16(central.length), u16(central.length),
    u32(centralBytes.length), u32(offset), u16(0),
  ]);
  return concat([...local, centralBytes, end]);
}

export function createScheduleXlsx(state) {
  const landscape = state.settings.layoutOrientation !== "portrait";
  const sheets = [
    { name: "本番進行表", data: scheduleRows(state, "main"), widths: [5, 34, 11, 11, 7, 11, 11, 11, 8, 8, 8, 38], landscape },
    { name: "GP進行表", data: scheduleRows(state, "gp"), widths: [5, 34, 11, 11, 7, 11, 11, 11, 8, 8, 8, 38], landscape },
    { name: "入力データ", data: inputRows(state), widths: [10, 32, 13, 13, 16, 8, 10, 10, 10, 38], landscape: true },
  ];
  const files = {
    "[Content_Types].xml": `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/><Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/><Override PartName="/xl/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.styles+xml"/>${sheets.map((_, index) => `<Override PartName="/xl/worksheets/sheet${index + 1}.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/>`).join("")}</Types>`,
    "_rels/.rels": `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="xl/workbook.xml"/></Relationships>`,
    "xl/workbook.xml": `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><workbook xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"><sheets>${sheets.map((sheet, index) => `<sheet name="${escapeXml(sheet.name)}" sheetId="${index + 1}" r:id="rId${index + 1}"/>`).join("")}</sheets></workbook>`,
    "xl/_rels/workbook.xml.rels": `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">${sheets.map((_, index) => `<Relationship Id="rId${index + 1}" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet${index + 1}.xml"/>`).join("")}<Relationship Id="rId${sheets.length + 1}" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/styles" Target="styles.xml"/></Relationships>`,
    "xl/styles.xml": stylesXml,
  };
  sheets.forEach((sheet, index) => {
    files[`xl/worksheets/sheet${index + 1}.xml`] = worksheetXml({ ...sheet.data, widths: sheet.widths, landscape: sheet.landscape });
  });
  return new Blob([zipStore(files)], { type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" });
}

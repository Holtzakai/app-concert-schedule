import { createItem, ITEM_TYPES } from "./schedule.js";

export function createSampleState() {
  const today = new Date();
  const date = new Date(today.getTime() - today.getTimezoneOffset() * 60_000).toISOString().slice(0, 10);
  return {
    schemaVersion: 2,
    settings: {
      organization: "〇〇学校吹奏楽部",
      title: "第○○回アンサンブルコンサート進行表",
      date,
      venue: "○○市民会館",
      doorsOpen: "13:00",
      openingCue: "13:28",
      firstStart: "13:30",
      gpStart: "10:00",
      tuningMinutes: 10,
      travelMinutes: 2,
      layoutOrientation: "landscape",
    },
    items: [
      createItem(ITEM_TYPES.PERFORMANCE, { name: "木管6重奏", durationMinutes: 6, prepMinutes: 1 }),
      createItem(ITEM_TYPES.PERFORMANCE, { name: "金管8重奏", durationMinutes: 6 }),
      createItem(ITEM_TYPES.PERFORMANCE, { name: "打楽器4重奏", durationMinutes: 7, prepMinutes: 3 }),
      createItem(ITEM_TYPES.BREAK, { name: "休憩", durationMinutes: 10, gapAfter: 1 }),
      createItem(ITEM_TYPES.PERFORMANCE, { name: "クラリネット5重奏", durationMinutes: 7 }),
      createItem(ITEM_TYPES.PERFORMANCE, {
        name: "サクソフォーン4重奏",
        durationMinutes: 8,
        announcement: "曲紹介、次の団体の準備確認",
      }),
      createItem(ITEM_TYPES.CUE, {
        name: "閉会の挨拶",
        durationMinutes: 3,
        stageLight: "暗",
        audienceLight: "明",
        announcement: "閉会の挨拶",
      }),
    ],
    gpOrder: [],
    activeView: "main",
  };
}

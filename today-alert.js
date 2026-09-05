// today-alert.js
import { db } from "./firebase.js";
import {
  collection,
  query,
  where,
  getDocs,
} from "https://www.gstatic.com/firebasejs/11.9.1/firebase-firestore.js";

const scheduleCol = collection(db, "schedule_events");

function pad(n) { return String(n).padStart(2, "0"); }
function todayKey() {
  const t = new Date();
  return `${t.getFullYear()}-${pad(t.getMonth() + 1)}-${pad(t.getDate())}`;
}

function escapeHtml(str) {
  const div = document.createElement("div");
  div.textContent = str || "";
  return div.innerHTML;
}

function typeLabel(type) {
  return type === "school" ? "전체 일정" : "학생회 일정";
}

async function checkTodayEvents() {
  try {
    const q = query(scheduleCol, where("date", "==", todayKey()));
    const snapshot = await getDocs(q);

    if (snapshot.empty) return;

    const events = snapshot.docs.map((d) => d.data());

    const listEl = document.getElementById("todayAlertList");
    listEl.innerHTML = events.map((e) => {
      const type = e.type === "school" ? "school" : "council";
      return `
        <div class="todayEventCard">
          <span class="todayTypeBadge ${type}">${typeLabel(type)}</span>
          <div class="todayEventTitle">${escapeHtml(e.title)}</div>
          ${e.place ? `<div class="todayEventMeta">${escapeHtml(e.place)}</div>` : ""}
          ${e.owner ? `<div class="todayEventMeta">담당 ${escapeHtml(e.owner)}</div>` : ""}
          ${e.memo ? `<div class="todayEventMeta">${escapeHtml(e.memo)}</div>` : ""}
        </div>
      `;
    }).join("");

    document.getElementById("todayAlertModal").classList.remove("hidden");
  } catch (err) {
    console.error("오늘의 일정 확인 중 오류:", err);
  }
}

document.addEventListener("DOMContentLoaded", () => {
  checkTodayEvents();

  const closeBtn = document.getElementById("todayAlertCloseBtn");
  const modal = document.getElementById("todayAlertModal");
  closeBtn.addEventListener("click", () => modal.classList.add("hidden"));
  modal.addEventListener("click", (e) => {
    if (e.target === modal) modal.classList.add("hidden");
  });
});

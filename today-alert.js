// today-alert.js
import { db } from "./firebase.js";
import {
  collection,
  query,
  where,
  getDocs,
  onSnapshot,
} from "https://www.gstatic.com/firebasejs/11.9.1/firebase-firestore.js";

const scheduleCol = collection(db, "schedule_events");

function pad(n) { return String(n).padStart(2, "0"); }
function todayKey() {
  const t = new Date();
  return `${t.getFullYear()}-${pad(t.getMonth() + 1)}-${pad(t.getDate())}`;
}
function formatDateLabel(key) {
  const WEEKDAY = ["일", "월", "화", "수", "목", "금", "토"];
  const [y, m, d] = key.split("-").map(Number);
  const weekday = WEEKDAY[new Date(y, m - 1, d).getDay()];
  return `${m}월 ${d}일 (${weekday})`;
}

function escapeHtml(str) {
  const div = document.createElement("div");
  div.textContent = str || "";
  return div.innerHTML;
}

function typeLabel(type) {
  return type === "school" ? "전체 일정" : "학생회 일정";
}

// ===== 오늘 일정 있으면 자동 팝업 =====
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

// ===== 메인 화면에 다가오는 일정 미리보기 (실시간) =====
function renderHomeUpcoming() {
  const listEl = document.getElementById("homeUpcomingList");
  if (!listEl) return;

  onSnapshot(scheduleCol, (snapshot) => {
    const today = todayKey();
    const events = snapshot.docs
      .map((d) => d.data())
      .filter((e) => e.date >= today && e.type !== "school")
      .sort((a, b) => a.date.localeCompare(b.date))
      .slice(0, 4);

    listEl.innerHTML = events.length
      ? events.map((e) => `
          <a class="eventCard" href="schedule.html?date=${e.date}">
            <div class="eventTop">
              <div>
                <span class="eventTypeBadge council">${typeLabel("council")}</span>
                <span class="eventDateBadge">${formatDateLabel(e.date)}</span>
                <div class="eventTitle">${escapeHtml(e.title)}</div>
              </div>
            </div>
            ${e.place ? `<div class="eventMeta">${escapeHtml(e.place)}</div>` : ""}
          </a>
        `).join("")
      : `<div class="card"><p class="emptyMsg">등록된 일정이 없어요</p></div>`;
  });
}

document.addEventListener("DOMContentLoaded", () => {
  checkTodayEvents();
  renderHomeUpcoming();

  const closeBtn = document.getElementById("todayAlertCloseBtn");
  const modal = document.getElementById("todayAlertModal");
  if (closeBtn && modal) {
    closeBtn.addEventListener("click", () => modal.classList.add("hidden"));
    modal.addEventListener("click", (e) => {
      if (e.target === modal) modal.classList.add("hidden");
    });
  }
});

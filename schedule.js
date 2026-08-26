// schedule.js
import { db } from "./firebase.js";
import {
  collection,
  addDoc,
  deleteDoc,
  doc,
  onSnapshot,
  serverTimestamp,
} from "https://www.gstatic.com/firebasejs/11.9.1/firebase-firestore.js";

const monthLabel = document.getElementById("monthLabel");
const calGrid = document.getElementById("calGrid");
const prevMonthBtn = document.getElementById("prevMonthBtn");
const nextMonthBtn = document.getElementById("nextMonthBtn");
const upcomingList = document.getElementById("upcomingList");

const dayModal = document.getElementById("dayModal");
const modalDateLabel = document.getElementById("modalDateLabel");
const modalEventList = document.getElementById("modalEventList");
const eventTitleInput = document.getElementById("eventTitle");
const eventPlaceInput = document.getElementById("eventPlace");
const eventOwnerInput = document.getElementById("eventOwner");
const eventMemoInput = document.getElementById("eventMemo");
const saveBtn = document.getElementById("saveBtn");
const closeModalBtn = document.getElementById("closeModalBtn");

// 학생회 일정 전용 컬렉션 (다른 컬렉션들과 완전히 분리)
const scheduleCol = collection(db, "schedule_events");

const WEEKDAY = ["일", "월", "화", "수", "목", "금", "토"];

let cursor = new Date();
cursor.setDate(1);
let allEvents = [];
let selectedDateKey = null;

function pad(n) { return String(n).padStart(2, "0"); }
function toKey(y, m, d) { return `${y}-${pad(m + 1)}-${pad(d)}`; }
function todayKey() {
  const t = new Date();
  return toKey(t.getFullYear(), t.getMonth(), t.getDate());
}
function formatDateLabel(key) {
  const [y, m, d] = key.split("-").map(Number);
  const weekday = WEEKDAY[new Date(y, m - 1, d).getDay()];
  return `${m}월 ${d}일 (${weekday})`;
}
function escapeHtml(str) {
  const div = document.createElement("div");
  div.textContent = str || "";
  return div.innerHTML;
}

function eventsByDate(key) {
  return allEvents.filter((e) => e.date === key);
}

function eventCardHTML(e) {
  return `
    <div class="eventCard">
      <div class="eventTop">
        <div class="eventTitle">${escapeHtml(e.title)}</div>
        <button class="deleteOneBtn" data-id="${e.id}">삭제</button>
      </div>
      ${e.place ? `<div class="eventMeta">📍 ${escapeHtml(e.place)}</div>` : ""}
      ${e.owner ? `<div class="eventMeta">담당: ${escapeHtml(e.owner)}</div>` : ""}
      ${e.memo ? `<div class="eventMemo">${escapeHtml(e.memo)}</div>` : ""}
    </div>
  `;
}

function renderCalendar() {
  const year = cursor.getFullYear();
  const month = cursor.getMonth();
  monthLabel.textContent = `${year}. ${pad(month + 1)}`;

  const firstDay = new Date(year, month, 1).getDay();
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const today = todayKey();

  calGrid.innerHTML = "";

  for (let i = 0; i < firstDay; i++) {
    const blank = document.createElement("div");
    blank.className = "dayCell blank";
    calGrid.appendChild(blank);
  }

  const MAX_CHIPS = 4;

  for (let d = 1; d <= daysInMonth; d++) {
    const key = toKey(year, month, d);
    const cell = document.createElement("button");
    cell.type = "button";
    cell.className = "dayCell" + (key === today ? " today" : "");

    const dayEvents = eventsByDate(key);
    const chips = dayEvents.slice(0, MAX_CHIPS).map(
      (e, i) => `<span class="dayEventChip c${i % 5}">${escapeHtml(e.title)}</span>`
    ).join("");
    const moreCount = dayEvents.length - MAX_CHIPS;
    const more = moreCount > 0 ? `<span class="dayEventMore">+${moreCount}개 더</span>` : "";

    cell.innerHTML = `<span class="dayNum">${d}</span>${chips}${more}`;
    cell.addEventListener("click", () => openDayModal(key));
    calGrid.appendChild(cell);
  }
}

function renderUpcoming() {
  const today = todayKey();
  const upcoming = allEvents
    .filter((e) => e.date >= today)
    .sort((a, b) => a.date.localeCompare(b.date));

  upcomingList.innerHTML = upcoming.length
    ? upcoming.map((e) => `
        <div class="eventCard">
          <div class="eventTop">
            <div>
              <span class="eventDateBadge">${formatDateLabel(e.date)}</span>
              <div class="eventTitle">${escapeHtml(e.title)}</div>
            </div>
            <button class="deleteOneBtn" data-id="${e.id}">삭제</button>
          </div>
          ${e.place ? `<div class="eventMeta">📍 ${escapeHtml(e.place)}</div>` : ""}
          ${e.owner ? `<div class="eventMeta">담당: ${escapeHtml(e.owner)}</div>` : ""}
          ${e.memo ? `<div class="eventMemo">${escapeHtml(e.memo)}</div>` : ""}
        </div>
      `).join("")
    : `<div class="card"><p class="emptyMsg">등록된 일정이 없어요</p></div>`;
}

function openDayModal(key) {
  selectedDateKey = key;
  modalDateLabel.textContent = formatDateLabel(key);

  const events = eventsByDate(key);
  modalEventList.innerHTML = events.length
    ? events.map(eventCardHTML).join("")
    : `<p class="emptyMsg">이 날짜엔 등록된 일정이 없어요</p>`;

  eventTitleInput.value = "";
  eventPlaceInput.value = "";
  eventOwnerInput.value = "";
  eventMemoInput.value = "";

  dayModal.classList.remove("hidden");
}

closeModalBtn.addEventListener("click", () => dayModal.classList.add("hidden"));
dayModal.addEventListener("click", (e) => {
  if (e.target === dayModal) dayModal.classList.add("hidden");
});

prevMonthBtn.addEventListener("click", () => {
  cursor = new Date(cursor.getFullYear(), cursor.getMonth() - 1, 1);
  renderCalendar();
});
nextMonthBtn.addEventListener("click", () => {
  cursor = new Date(cursor.getFullYear(), cursor.getMonth() + 1, 1);
  renderCalendar();
});

// 실시간 반영: 누구든 등록/삭제하면 모든 화면에 바로 반영됨
onSnapshot(scheduleCol, (snapshot) => {
  allEvents = snapshot.docs.map((docSnap) => ({ id: docSnap.id, ...docSnap.data() }));
  renderCalendar();
  renderUpcoming();
  if (selectedDateKey && !dayModal.classList.contains("hidden")) {
    const events = eventsByDate(selectedDateKey);
    modalEventList.innerHTML = events.length
      ? events.map(eventCardHTML).join("")
      : `<p class="emptyMsg">이 날짜엔 등록된 일정이 없어요</p>`;
  }
});

// 삭제 버튼 (이벤트 위임 - 모달 안 + 다가오는 일정 목록 둘 다 처리)
document.addEventListener("click", async (e) => {
  if (!e.target.classList.contains("deleteOneBtn")) return;
  const id = e.target.dataset.id;
  if (!id) return;
  await deleteDoc(doc(db, "schedule_events", id));
});

// 등록
saveBtn.addEventListener("click", async () => {
  const title = eventTitleInput.value.trim();
  const place = eventPlaceInput.value.trim();
  const owner = eventOwnerInput.value.trim();
  const memo = eventMemoInput.value.trim();

  if (!selectedDateKey || !title) {
    alert("제목을 입력해주세요.");
    return;
  }

  saveBtn.disabled = true;
  try {
    await addDoc(scheduleCol, {
      date: selectedDateKey, title, place, owner, memo,
      createdAt: serverTimestamp(),
    });

    eventTitleInput.value = "";
    eventPlaceInput.value = "";
    eventOwnerInput.value = "";
    eventMemoInput.value = "";
  } catch (err) {
    console.error(err);
    alert("등록 중 오류가 발생했습니다. 콘솔을 확인해주세요.");
  } finally {
    saveBtn.disabled = false;
  }
});

renderCalendar();

// schedule.js
import { db } from "./firebase.js";
import {
  collection,
  addDoc,
  updateDoc,
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
const formLabel = document.getElementById("formLabel");
const cancelEditBtn = document.getElementById("cancelEditBtn");
const typeCouncilBtn = document.getElementById("typeCouncilBtn");
const typeSchoolBtn = document.getElementById("typeSchoolBtn");
const eventTitleInput = document.getElementById("eventTitle");
const eventPlaceInput = document.getElementById("eventPlace");
const eventOwnerInput = document.getElementById("eventOwner");
const eventMemoInput = document.getElementById("eventMemo");
const saveBtn = document.getElementById("saveBtn");
const closeModalBtn = document.getElementById("closeModalBtn");

// 학생회 일정 전용 컬렉션 (다른 컬렉션들과 완전히 분리)
const scheduleCol = collection(db, "schedule_events");

const WEEKDAY = ["일", "월", "화", "수", "목", "금", "토"];

// 2026년 대한민국 공휴일 (달력에 다른 해가 표시될 경우 이 목록엔 해당 사항 없음)
const HOLIDAYS_2026 = {
  "2026-01-01": "신정",
  "2026-02-16": "설날연휴",
  "2026-02-17": "설날",
  "2026-02-18": "설날연휴",
  "2026-03-01": "삼일절",
  "2026-03-02": "대체공휴일",
  "2026-05-05": "어린이날",
  "2026-05-24": "부처님오신날",
  "2026-05-25": "대체공휴일",
  "2026-06-03": "지방선거일",
  "2026-06-06": "현충일",
  "2026-07-17": "제헌절",
  "2026-08-15": "광복절",
  "2026-08-17": "대체공휴일",
  "2026-09-24": "추석연휴",
  "2026-09-25": "추석",
  "2026-09-26": "추석연휴",
  "2026-10-03": "개천절",
  "2026-10-05": "대체공휴일",
  "2026-10-09": "한글날",
  "2026-12-25": "성탄절",
};

let cursor = new Date();
cursor.setDate(1);
let allEvents = [];
let selectedDateKey = null;
let editingId = null;
let currentType = "council"; // "council" | "school"

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

function typeLabel(type) {
  return type === "school" ? "전체 일정" : "학생회 일정";
}

function eventCardHTML(e, { withDateBadge, jumpable } = {}) {
  const type = e.type === "school" ? "school" : "council";
  return `
    <div class="eventCard ${type}" ${jumpable ? `data-jump-date="${e.date}"` : ""}>
      <div class="eventTop">
        <div>
          <span class="eventTypeBadge ${type}">${typeLabel(type)}</span>
          ${withDateBadge ? `<span class="eventDateBadge">${formatDateLabel(e.date)}</span>` : ""}
          <div class="eventTitle">${escapeHtml(e.title)}</div>
        </div>
        <div class="eventBtns">
          <button class="editOneBtn" data-id="${e.id}">수정</button>
          <button class="deleteOneBtn" data-id="${e.id}">삭제</button>
        </div>
      </div>
      ${e.place ? `<div class="eventMeta">📍 ${escapeHtml(e.place)}</div>` : ""}
      ${e.owner ? `<div class="eventMeta">담당: ${escapeHtml(e.owner)}</div>` : ""}
      ${e.memo ? `<div class="eventMemo">${escapeHtml(e.memo)}</div>` : ""}
    </div>
  `;
}

function setType(type) {
  currentType = type;
  typeCouncilBtn.classList.toggle("active", type === "council");
  typeSchoolBtn.classList.toggle("active", type === "school");
}
typeCouncilBtn.addEventListener("click", () => setType("council"));
typeSchoolBtn.addEventListener("click", () => setType("school"));

function resetForm() {
  editingId = null;
  eventTitleInput.value = "";
  eventPlaceInput.value = "";
  eventOwnerInput.value = "";
  eventMemoInput.value = "";
  setType("council");
  formLabel.textContent = "새 일정 등록";
  saveBtn.textContent = "등록";
  cancelEditBtn.classList.add("hidden");
}

function startEdit(ev) {
  editingId = ev.id;
  eventTitleInput.value = ev.title || "";
  eventPlaceInput.value = ev.place || "";
  eventOwnerInput.value = ev.owner || "";
  eventMemoInput.value = ev.memo || "";
  setType(ev.type === "school" ? "school" : "council");
  formLabel.textContent = "일정 수정";
  saveBtn.textContent = "수정 완료";
  cancelEditBtn.classList.remove("hidden");
  eventTitleInput.scrollIntoView({ behavior: "smooth", block: "center" });
}

cancelEditBtn.addEventListener("click", resetForm);

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

  const MAX_CHIPS = 3;

  for (let d = 1; d <= daysInMonth; d++) {
    const key = toKey(year, month, d);
    const weekday = new Date(year, month, d).getDay(); // 0=일 ... 6=토
    const holidayName = HOLIDAYS_2026[key];
    const isSun = weekday === 0 || !!holidayName;
    const isSat = weekday === 6;

    const cell = document.createElement("button");
    cell.type = "button";
    const dayEvents = eventsByDate(key);
    const hasSchool = dayEvents.some((e) => e.type === "school");
    const hasCouncil = dayEvents.some((e) => e.type !== "school");
    let typeClass = "";
    if (hasSchool) typeClass = " has-school";
    else if (hasCouncil) typeClass = " has-council";
    cell.className = "dayCell" + (key === today ? " today" : "") + typeClass;

    const numClass = isSun ? "sun" : (isSat ? "sat" : "");

    const chips = dayEvents.slice(0, MAX_CHIPS).map(
      (e) => `<span class="dayEventChip ${e.type === "school" ? "school" : "council"}">${escapeHtml(e.title)}</span>`
    ).join("");
    const moreCount = dayEvents.length - MAX_CHIPS;
    const more = moreCount > 0 ? `<span class="dayEventMore">+${moreCount}개 더</span>` : "";
    const holidayHtml = holidayName ? `<span class="holidayLabel">${holidayName}</span>` : "";

    cell.dataset.key = key;
    cell.innerHTML = `<span class="dayNum ${numClass}">${d}</span>${holidayHtml}${chips}${more}`;
    cell.addEventListener("click", () => openDayModal(key));
    calGrid.appendChild(cell);
  }
}

function renderUpcoming() {
  const today = todayKey();
  const upcoming = allEvents
    .filter((e) => e.date >= today && e.type !== "school")
    .sort((a, b) => a.date.localeCompare(b.date));

  upcomingList.innerHTML = upcoming.length
    ? upcoming.map((e) => eventCardHTML(e, { withDateBadge: true, jumpable: true })).join("")
    : `<div class="card"><p class="emptyMsg">등록된 일정이 없어요</p></div>`;
}

function refreshModalList() {
  if (!selectedDateKey) return;
  const events = eventsByDate(selectedDateKey);
  modalEventList.innerHTML = events.length
    ? events.map((e) => eventCardHTML(e, { withDateBadge: false })).join("")
    : `<p class="emptyMsg">이 날짜엔 등록된 일정이 없어요</p>`;
}

function openDayModal(key) {
  selectedDateKey = key;
  modalDateLabel.textContent = formatDateLabel(key);
  resetForm();
  refreshModalList();
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

// 실시간 반영: 누구든 등록/수정/삭제하면 모든 화면에 바로 반영됨
onSnapshot(scheduleCol, (snapshot) => {
  allEvents = snapshot.docs.map((docSnap) => ({ id: docSnap.id, ...docSnap.data() }));
  renderCalendar();
  renderUpcoming();
  if (!dayModal.classList.contains("hidden")) refreshModalList();
});

// 수정/삭제 버튼 (이벤트 위임 - 모달 안 + 다가오는 일정 목록 둘 다 처리)
document.addEventListener("click", async (e) => {
  if (e.target.classList.contains("deleteOneBtn")) {
    const id = e.target.dataset.id;
    if (!id) return;
    await deleteDoc(doc(db, "schedule_events", id));
    if (editingId === id) resetForm();
    return;
  }
  if (e.target.classList.contains("editOneBtn")) {
    const id = e.target.dataset.id;
    const ev = allEvents.find((e2) => e2.id === id);
    if (!ev) return;
    selectedDateKey = ev.date;
    modalDateLabel.textContent = formatDateLabel(ev.date);
    if (dayModal.classList.contains("hidden")) {
      refreshModalList();
      dayModal.classList.remove("hidden");
    }
    startEdit(ev);
    return;
  }

  // "다가오는 일정" 카드를 눌렀을 때 (수정/삭제 버튼이 아닌 카드 본문) -> 달력에서 해당 날짜로 이동
  const jumpCard = e.target.closest("[data-jump-date]");
  if (jumpCard) {
    jumpToDate(jumpCard.dataset.jumpDate);
  }
});

function jumpToDate(key) {
  const [y, m] = key.split("-").map(Number);
  cursor = new Date(y, m - 1, 1);
  renderCalendar();

  const calCard = document.querySelector(".calCard");
  if (calCard) calCard.scrollIntoView({ behavior: "smooth", block: "start" });

  // 살짝 딜레이 후 해당 날짜 칸 강조 (렌더링 완료 대기)
  setTimeout(() => {
    const cell = calGrid.querySelector(`[data-key="${key}"]`);
    if (cell) {
      cell.classList.add("jump-highlight");
      setTimeout(() => cell.classList.remove("jump-highlight"), 1800);
    }
  }, 300);
}

// 등록 / 수정 저장
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
    if (editingId) {
      await updateDoc(doc(db, "schedule_events", editingId), {
        title, place, owner, memo, type: currentType,
      });
    } else {
      await addDoc(scheduleCol, {
        date: selectedDateKey, title, place, owner, memo, type: currentType,
        createdAt: serverTimestamp(),
      });
    }
    resetForm();
  } catch (err) {
    console.error(err);
    alert("저장 중 오류가 발생했습니다. 콘솔을 확인해주세요.");
  } finally {
    saveBtn.disabled = false;
  }
});

renderCalendar();

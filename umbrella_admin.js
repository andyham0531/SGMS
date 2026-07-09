// umbrella_admin.js
import { db } from "./firebase.js";
import { studentsData } from "./students-data.js";
import {
  collection,
  doc,
  setDoc,
  updateDoc,
  addDoc,
  getDocs,
  query,
  where,
  onSnapshot,
  serverTimestamp,
} from "https://www.gstatic.com/firebasejs/11.9.1/firebase-firestore.js";

const TOTAL_UMBRELLAS = 15;
const OVERDUE_DAYS = 3;
const LOST_FINE = 5000;
const BAN_DAYS = 30;

const managerSelect = document.getElementById("managerSelect");
const umbrellaGrid = document.getElementById("umbrellaGrid");
const overdueList = document.getElementById("overdueList");

const rentModal = document.getElementById("rentModal");
const returnModal = document.getElementById("returnModal");
const rentTitle = document.getElementById("rentTitle");
const returnTitle = document.getElementById("returnTitle");

const studentIdInput = document.getElementById("studentId");
const studentNameInput = document.getElementById("studentName");

const rentBtn = document.getElementById("rentBtn");
const returnBtn = document.getElementById("returnBtn");
const lostBtn = document.getElementById("lostBtn");
const closeRentBtn = document.getElementById("closeRent");
const closeReturnBtn = document.getElementById("closeReturn");

const returnInfo = document.getElementById("returnInfo");

const rentSignaturePad = document.getElementById("rentSignaturePad");
const clearRentSignatureBtn = document.getElementById("clearRentSignature");
const rentSigCtx = rentSignaturePad.getContext("2d");
let hasRentSignature = false;

let currentManager = "";
let currentUmbrella = null;
let umbrellaData = {};

// 실시간 상태 = "umbrellas" 컬렉션 (문서 ID = 우산 번호)
const umbrellaCol = collection(db, "umbrellas");
// 대여/반납/분실 이력 로그 = "umbrella_records" 컬렉션
const recordCol = collection(db, "umbrella_records");

managerSelect.addEventListener("change", () => {
  currentManager = managerSelect.value;
});

studentIdInput.addEventListener("input", () => {
  const id = studentIdInput.value.trim();
  if (studentsData[id]) {
    studentNameInput.value = studentsData[id];
  }
});

closeRentBtn.addEventListener("click", () => rentModal.classList.add("hidden"));
closeReturnBtn.addEventListener("click", () => returnModal.classList.add("hidden"));

rentModal.addEventListener("click", (e) => {
  if (e.target === rentModal) rentModal.classList.add("hidden");
});
returnModal.addEventListener("click", (e) => {
  if (e.target === returnModal) returnModal.classList.add("hidden");
});

// ===== 서명 캔버스 (공용 함수) =====
function setupSignaturePad(canvas, ctx, onDraw) {
  function getPos(e) {
    const rect = canvas.getBoundingClientRect();
    const clientX = e.touches ? e.touches[0].clientX : e.clientX;
    const clientY = e.touches ? e.touches[0].clientY : e.clientY;
    return { x: clientX - rect.left, y: clientY - rect.top };
  }

  let drawing = false;

  function startDraw(e) {
    drawing = true;
    onDraw(true);
    const pos = getPos(e);
    ctx.beginPath();
    ctx.moveTo(pos.x, pos.y);
    e.preventDefault();
  }
  function draw(e) {
    if (!drawing) return;
    const pos = getPos(e);
    ctx.lineTo(pos.x, pos.y);
    ctx.strokeStyle = "#1b2a4a";
    ctx.lineWidth = 2;
    ctx.lineCap = "round";
    ctx.stroke();
    e.preventDefault();
  }
  function endDraw() {
    drawing = false;
  }

  canvas.addEventListener("mousedown", startDraw);
  canvas.addEventListener("mousemove", draw);
  canvas.addEventListener("mouseup", endDraw);
  canvas.addEventListener("mouseleave", endDraw);
  canvas.addEventListener("touchstart", startDraw);
  canvas.addEventListener("touchmove", draw);
  canvas.addEventListener("touchend", endDraw);
}

setupSignaturePad(rentSignaturePad, rentSigCtx, (v) => (hasRentSignature = v));

clearRentSignatureBtn.addEventListener("click", () => {
  rentSigCtx.clearRect(0, 0, rentSignaturePad.width, rentSignaturePad.height);
  hasRentSignature = false;
});

function getPassedDays(time) {
  if (!time) return 0;
  const date = time.toDate ? time.toDate() : new Date(time);
  return Math.floor((Date.now() - date.getTime()) / 86400000);
}

function getStatusClass(data) {
  if (!data || !data.status || data.status === "대여가능") return "available";
  if (data.status === "분실") return "lost";
  if (data.status === "대여중") {
    return getPassedDays(data.rentDate) >= OVERDUE_DAYS ? "overdue" : "rented";
  }
  return "available";
}

// ===== 실시간 우산 상태 =====
onSnapshot(umbrellaCol, (snapshot) => {
  umbrellaData = {};
  snapshot.forEach((docSnap) => {
    umbrellaData[docSnap.id] = docSnap.data();
  });
  renderGrid();
  renderOverdue();
});

function renderGrid() {
  umbrellaGrid.innerHTML = "";
  for (let i = 1; i <= TOTAL_UMBRELLAS; i++) {
    const data = umbrellaData[i] || { status: "대여가능" };
    const card = document.createElement("div");
    card.className = `umbrellaCard ${getStatusClass(data)}`;

    let text = "대여가능";
    if (data.status === "대여중") {
      text = `${data.studentName}<br>${getPassedDays(data.rentDate)}일`;
    } else if (data.status === "분실") {
      text = "분실 (탭하여 복구)";
    }

    card.innerHTML = `
      <div class="umbrellaNumber">${i}번</div>
      <div class="umbrellaState">${text}</div>
    `;
    card.addEventListener("click", () => openUmbrella(i, data));
    umbrellaGrid.appendChild(card);
  }
}

function renderOverdue() {
  overdueList.innerHTML = "";
  let hasOverdue = false;

  Object.entries(umbrellaData).forEach(([num, data]) => {
    if (data.status !== "대여중") return;
    const day = getPassedDays(data.rentDate);
    if (day < OVERDUE_DAYS) return;

    hasOverdue = true;
    const div = document.createElement("div");
    div.className = "overdueItem";
    div.innerHTML = `
      ${num}번 · ${data.studentName} (${data.studentId}) · ${day}일 경과
      <button class="reminderBtn" data-num="${num}">알림 보내기</button>
    `;
    overdueList.appendChild(div);
  });

  if (!hasOverdue) {
    overdueList.textContent = "없음";
  }
}

overdueList.addEventListener("click", (e) => {
  if (!e.target.classList.contains("reminderBtn")) return;
  const num = e.target.dataset.num;
  sendReminder(num, umbrellaData[num]);
});

async function openUmbrella(number, data) {
  if (currentManager === "") {
    alert("담당자를 먼저 선택해주세요.");
    return;
  }
  currentUmbrella = number;

  if (!data.status || data.status === "대여가능") {
    openRent(number);
  } else if (data.status === "대여중") {
    openReturn(number, data);
  } else if (data.status === "분실") {
    const restore = confirm(
      `${number}번 우산은 분실 처리된 상태입니다.\n다시 찾으셨나요?\n확인을 누르면 "대여가능" 상태로 복구됩니다.`
    );
    if (restore) {
      await setDoc(doc(db, "umbrellas", String(number)), {
        number,
        status: "대여가능",
      });
    }
  }
}

// ===== 대여 금지(연체 이력) 확인 =====
async function checkBan(studentId) {
  const snap = await getDocs(query(recordCol, where("studentId", "==", studentId)));
  const now = Date.now();
  let banUntilDate = null;

  snap.forEach((docSnap) => {
    const d = docSnap.data();
    if (d.banUntil) {
      const until = d.banUntil.toDate ? d.banUntil.toDate() : new Date(d.banUntil);
      if (until.getTime() > now && (!banUntilDate || until > banUntilDate)) {
        banUntilDate = until;
      }
    }
  });

  return banUntilDate;
}

function openRent(number) {
  rentTitle.textContent = `${number}번 우산 대여`;
  studentIdInput.value = "";
  studentNameInput.value = "";
  rentSigCtx.clearRect(0, 0, rentSignaturePad.width, rentSignaturePad.height);
  hasRentSignature = false;
  rentModal.classList.remove("hidden");
}

function openReturn(number, data) {
  returnTitle.textContent = `${number}번 우산 반납`;
  returnInfo.innerHTML = `<b>${data.studentName}</b><br>${data.studentId}`;
  returnModal.classList.remove("hidden");
}

// ===== 대여 처리 =====
async function submitRent() {
  const studentId = studentIdInput.value.trim();
  const studentName = studentNameInput.value.trim();

  if (!studentId || !studentName) {
    alert("학번과 이름을 입력해주세요.");
    return;
  }

  rentBtn.disabled = true;
  try {
    const banUntil = await checkBan(studentId);
    if (banUntil) {
      const dateStr = banUntil.toLocaleDateString("ko-KR");
      alert(`이 학생은 연체 이력으로 인해 현재 대여가 제한된 상태입니다.\n(해제일: ${dateStr})`);
      return;
    }

    const rentDate = serverTimestamp();
    const signatureData = hasRentSignature ? rentSignaturePad.toDataURL("image/png") : "";

    // 대여 이력을 지금 바로 생성 (반납 전까지는 반납일 없음)
    const recordRef = await addDoc(recordCol, {
      umbrellaNumber: currentUmbrella,
      studentId,
      studentName,
      manager: currentManager,
      rentDate,
      returnDate: null,
      overdueDays: 0,
      isOverdue: false,
      banUntil: null,
      signature: signatureData,
      status: "대여중",
    });

    await setDoc(doc(db, "umbrellas", String(currentUmbrella)), {
      number: currentUmbrella,
      status: "대여중",
      studentId,
      studentName,
      manager: currentManager,
      rentDate,
      recordId: recordRef.id,
    });

    rentModal.classList.add("hidden");
  } finally {
    rentBtn.disabled = false;
  }
}

// ===== 반납 처리 =====
async function submitReturn() {
  const data = umbrellaData[currentUmbrella];
  if (!data) return;

  returnBtn.disabled = true;
  try {
    const overdueDays = getPassedDays(data.rentDate);
    const isOverdue = overdueDays >= OVERDUE_DAYS;

    await setDoc(doc(db, "umbrellas", String(currentUmbrella)), {
      number: currentUmbrella,
      status: "대여가능",
    });

    if (data.recordId) {
      await updateDoc(doc(db, "umbrella_records", data.recordId), {
        returnDate: serverTimestamp(),
        overdueDays: isOverdue ? overdueDays : 0,
        isOverdue,
        banUntil: isOverdue ? new Date(Date.now() + BAN_DAYS * 86400000) : null,
        status: "반납완료",
      });
    }

    returnModal.classList.add("hidden");

    if (isOverdue) {
      alert(`반납 처리되었습니다.\n연체(${overdueDays}일)로 인해 이 학생은 ${BAN_DAYS}일간 대여가 제한됩니다.`);
    }
  } finally {
    returnBtn.disabled = false;
  }
}

// ===== 분실 처리 =====
async function submitLost() {
  const data = umbrellaData[currentUmbrella];
  const ok = confirm(
    `${currentUmbrella}번 우산을 분실 처리하시겠습니까?\n대여자에게 벌금 ${LOST_FINE.toLocaleString()}원 안내가 필요합니다.`
  );
  if (!ok) return;

  await updateDoc(doc(db, "umbrellas", String(currentUmbrella)), {
    status: "분실",
  });

  if (data?.recordId) {
    await updateDoc(doc(db, "umbrella_records", data.recordId), {
      status: "분실",
      fine: LOST_FINE,
      lostDate: serverTimestamp(),
    });
  }

  returnModal.classList.add("hidden");
  alert("분실 처리되었습니다. (그리드에서 해당 우산을 다시 탭하면 나중에 찾았을 때 복구할 수 있어요)");
}

rentBtn.addEventListener("click", submitRent);
returnBtn.addEventListener("click", submitReturn);
lostBtn.addEventListener("click", submitLost);

// ===== 알림 문구 공유/복사 =====
function sendReminder(number, data) {
  if (!data) return;
  const day = getPassedDays(data.rentDate);
  const text = `[다원 우산대여]\n${data.studentName}님, ${number}번 우산이 ${day}일째 미반납 상태입니다.\n빠른 반납 부탁드립니다 🙏\n(3일 이상 연체 시 한 달간 대여가 제한됩니다)`;

  if (navigator.share) {
    navigator.share({ text }).catch(() => {
      navigator.clipboard.writeText(text);
      alert("알림 문구가 복사되었습니다!");
    });
  } else {
    navigator.clipboard.writeText(text);
    alert("알림 문구가 복사되었습니다!");
  }
}

// 경과일 실시간 갱신 (1분마다)
setInterval(() => {
  renderGrid();
  renderOverdue();
}, 60000);

console.log("Umbrella Admin Ready");

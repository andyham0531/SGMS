// umbrella_check.js
import { db } from "./firebase.js";
import { studentsData } from "./students-data.js";
import {
  collection,
  doc,
  setDoc,
  addDoc,
  getDocs,
  query,
  where,
} from "https://www.gstatic.com/firebasejs/11.9.1/firebase-firestore.js";
import { serverTimestamp } from "https://www.gstatic.com/firebasejs/11.9.1/firebase-firestore.js";

const TOTAL_UMBRELLAS = 15;
const OVERDUE_DAYS = 3;
const BAN_DAYS = 30;

const studentIdInput = document.getElementById("studentId");
const studentNameInput = document.getElementById("studentName");
const checkBtn = document.getElementById("checkBtn");

const returnBox = document.getElementById("returnBox");
const returnTitle = document.getElementById("returnTitle");
const returnNumber = document.getElementById("returnNumber");
const returnDate = document.getElementById("returnDate");
const returnDays = document.getElementById("returnDays");
const doReturnBtn = document.getElementById("doReturnBtn");

const rentBox = document.getElementById("rentBox");
const availableList = document.getElementById("availableList");

const banMsg = document.getElementById("banMsg");

const signaturePad = document.getElementById("signaturePad");
const clearSignatureBtn = document.getElementById("clearSignature");
const sigCtx = signaturePad.getContext("2d");
let isDrawing = false;
let hasSignature = false;

const umbrellaCol = collection(db, "umbrellas");
const recordCol = collection(db, "umbrella_records");

let currentNumberFound = null;
let currentDataFound = null;

studentIdInput.addEventListener("input", () => {
  const id = studentIdInput.value.trim();
  if (studentsData[id]) {
    studentNameInput.value = studentsData[id];
  }
});

// ===== 서명 캔버스 =====
function getPos(e) {
  const rect = signaturePad.getBoundingClientRect();
  const clientX = e.touches ? e.touches[0].clientX : e.clientX;
  const clientY = e.touches ? e.touches[0].clientY : e.clientY;
  return { x: clientX - rect.left, y: clientY - rect.top };
}
function startDraw(e) {
  isDrawing = true;
  hasSignature = true;
  const pos = getPos(e);
  sigCtx.beginPath();
  sigCtx.moveTo(pos.x, pos.y);
  e.preventDefault();
}
function draw(e) {
  if (!isDrawing) return;
  const pos = getPos(e);
  sigCtx.lineTo(pos.x, pos.y);
  sigCtx.strokeStyle = "#1b2a4a";
  sigCtx.lineWidth = 2;
  sigCtx.lineCap = "round";
  sigCtx.stroke();
  e.preventDefault();
}
function endDraw() {
  isDrawing = false;
}
signaturePad.addEventListener("mousedown", startDraw);
signaturePad.addEventListener("mousemove", draw);
signaturePad.addEventListener("mouseup", endDraw);
signaturePad.addEventListener("mouseleave", endDraw);
signaturePad.addEventListener("touchstart", startDraw);
signaturePad.addEventListener("touchmove", draw);
signaturePad.addEventListener("touchend", endDraw);
clearSignatureBtn.addEventListener("click", () => {
  sigCtx.clearRect(0, 0, signaturePad.width, signaturePad.height);
  hasSignature = false;
});

function getPassedDays(time) {
  if (!time) return 0;
  const date = time.toDate ? time.toDate() : new Date(time);
  return Math.floor((Date.now() - date.getTime()) / 86400000);
}

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

// ===== 조회 =====
async function checkStatus() {
  const studentId = studentIdInput.value.trim();
  const studentName = studentNameInput.value.trim();

  if (!studentId || !studentName) {
    alert("학번과 이름을 모두 입력해주세요.");
    return;
  }

  returnBox.classList.add("hidden");
  rentBox.classList.add("hidden");
  banMsg.classList.add("hidden");

  checkBtn.disabled = true;
  try {
    const snapshot = await getDocs(umbrellaCol);
    let found = null;
    let foundNumber = null;

    snapshot.forEach((docSnap) => {
      const data = docSnap.data();
      if (data.studentId === studentId && data.status === "대여중") {
        found = data;
        foundNumber = docSnap.id;
      }
    });

    if (found) {
      // 대여중 -> 반납 화면
      currentNumberFound = foundNumber;
      currentDataFound = found;

      const days = getPassedDays(found.rentDate);
      const dateStr = found.rentDate && found.rentDate.toDate
        ? found.rentDate.toDate().toLocaleDateString("ko-KR")
        : "-";

      returnTitle.textContent = `${found.studentName} (${studentId})`;
      returnNumber.textContent = `${foundNumber}번`;
      returnDate.textContent = dateStr;
      returnDays.textContent = days >= OVERDUE_DAYS ? `${days}일째 ⚠️ 연체` : `${days}일째`;

      sigCtx.clearRect(0, 0, signaturePad.width, signaturePad.height);
      hasSignature = false;

      returnBox.classList.remove("hidden");
      return;
    }

    // 대여중 아님 -> 대여 금지 여부 확인
    const banUntil = await checkBan(studentId);
    if (banUntil) {
      banMsg.textContent = `연체 이력으로 인해 현재 대여가 제한된 상태입니다. (해제일: ${banUntil.toLocaleDateString("ko-KR")})`;
      banMsg.classList.remove("hidden");
      return;
    }

    // 대여 가능한 우산 목록 표시
    const umbrellaData = {};
    snapshot.forEach((docSnap) => {
      umbrellaData[docSnap.id] = docSnap.data();
    });

    availableList.innerHTML = "";
    let anyAvailable = false;

    for (let i = 1; i <= TOTAL_UMBRELLAS; i++) {
      const data = umbrellaData[i];
      if (data && data.status && data.status !== "대여가능") continue;

      anyAvailable = true;
      const card = document.createElement("div");
      card.className = "umbrellaCard available";
      card.innerHTML = `<div class="umbrellaNumber">${i}번</div><div class="umbrellaState">대여가능</div>`;
      card.addEventListener("click", () => rentUmbrella(i, studentId, studentName));
      availableList.appendChild(card);
    }

    if (!anyAvailable) {
      availableList.innerHTML = "<p>지금 대여 가능한 우산이 없습니다.</p>";
    }

    rentBox.classList.remove("hidden");
  } catch (err) {
    console.error(err);
    alert("조회 중 오류가 발생했습니다. 콘솔을 확인해주세요.");
  } finally {
    checkBtn.disabled = false;
  }
}

// ===== 셀프 대여 =====
async function rentUmbrella(number, studentId, studentName) {
  const ok = confirm(`${number}번 우산을 대여하시겠습니까?`);
  if (!ok) return;

  await setDoc(doc(db, "umbrellas", String(number)), {
    number,
    status: "대여중",
    studentId,
    studentName,
    manager: "본인(셀프)",
    rentDate: serverTimestamp(),
  });

  alert(`${number}번 우산이 대여되었습니다!`);
  rentBox.classList.add("hidden");
}

// ===== 셀프 반납 =====
doReturnBtn.addEventListener("click", async () => {
  if (!currentNumberFound || !currentDataFound) return;

  if (!hasSignature) {
    const skip = confirm("서명이 없습니다. 서명 없이 반납 처리하시겠습니까?");
    if (!skip) return;
  }

  doReturnBtn.disabled = true;
  try {
    const overdueDays = getPassedDays(currentDataFound.rentDate);
    const isOverdue = overdueDays >= OVERDUE_DAYS;
    const signatureData = hasSignature ? signaturePad.toDataURL("image/png") : "";

    await setDoc(doc(db, "umbrellas", String(currentNumberFound)), {
      number: currentNumberFound,
      status: "대여가능",
    });

    await addDoc(recordCol, {
      umbrellaNumber: currentNumberFound,
      studentId: currentDataFound.studentId,
      studentName: currentDataFound.studentName,
      manager: "본인(셀프)",
      rentDate: currentDataFound.rentDate || null,
      returnDate: serverTimestamp(),
      overdueDays: isOverdue ? overdueDays : 0,
      isOverdue,
      banUntil: isOverdue ? new Date(Date.now() + BAN_DAYS * 86400000) : null,
      signature: signatureData,
      status: "반납완료",
    });

    returnBox.classList.add("hidden");
    currentNumberFound = null;
    currentDataFound = null;

    if (isOverdue) {
      alert(`반납되었습니다.\n연체(${overdueDays}일)로 인해 ${BAN_DAYS}일간 대여가 제한됩니다.`);
    } else {
      alert("반납되었습니다. 감사합니다!");
    }
  } finally {
    doReturnBtn.disabled = false;
  }
});

checkBtn.addEventListener("click", checkStatus);
studentNameInput.addEventListener("keydown", (e) => {
  if (e.key === "Enter") checkStatus();
});

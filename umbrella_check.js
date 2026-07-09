// umbrella_check.js
import { db } from "./firebase.js";
import {
  collection,
  getDocs,
} from "https://www.gstatic.com/firebasejs/11.9.1/firebase-firestore.js";

const studentIdInput = document.getElementById("studentId");
const checkBtn = document.getElementById("checkBtn");
const resultBox = document.getElementById("resultBox");
const resultTitle = document.getElementById("resultTitle");
const resultNumber = document.getElementById("resultNumber");
const resultDate = document.getElementById("resultDate");
const resultDays = document.getElementById("resultDays");

const OVERDUE_DAYS = 3;
const LOST_FINE = 5000;

const umbrellaCol = collection(db, "umbrellas");

function getPassedDays(time) {
  if (!time) return 0;
  const date = time.toDate ? time.toDate() : new Date(time);
  return Math.floor((Date.now() - date.getTime()) / 86400000);
}

async function checkStatus() {
  const studentId = studentIdInput.value.trim();
  if (!studentId) {
    alert("학번을 입력해주세요.");
    return;
  }

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

    if (!found) {
      resultBox.classList.add("hidden");
      alert("현재 대여중인 우산이 없습니다.");
      return;
    }

    const days = getPassedDays(found.rentDate);
    const dateStr = found.rentDate && found.rentDate.toDate
      ? found.rentDate.toDate().toLocaleDateString("ko-KR")
      : "-";

    resultTitle.textContent = `${found.studentName} (${studentId})`;
    resultNumber.textContent = `${foundNumber}번`;
    resultDate.textContent = dateStr;
    resultDays.textContent =
      days >= OVERDUE_DAYS
        ? `${days}일째 ⚠️ (분실 시 벌금 ${LOST_FINE.toLocaleString()}원)`
        : `${days}일째`;

    resultBox.classList.remove("hidden");
  } catch (err) {
    console.error(err);
    alert("조회 중 오류가 발생했습니다. 콘솔을 확인해주세요.");
  } finally {
    checkBtn.disabled = false;
  }
}

checkBtn.addEventListener("click", checkStatus);
studentIdInput.addEventListener("keydown", (e) => {
  if (e.key === "Enter") checkStatus();
});

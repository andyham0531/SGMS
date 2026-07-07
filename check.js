// check.js
import { db } from "./firebase.js";
import { studentsData } from "./students-data.js";
import {
  doc,
  getDoc,
} from "https://www.gstatic.com/firebasejs/11.9.1/firebase-firestore.js";

const studentIdInput = document.getElementById("studentId");
const checkBtn = document.getElementById("checkBtn");
const resultBox = document.getElementById("resultBox");
const resultName = document.getElementById("resultName");
const resultCount = document.getElementById("resultCount");
const resultPenalty = document.getElementById("resultPenalty");

async function checkStudent() {
  const studentId = studentIdInput.value.trim();

  if (!studentId) {
    alert("학번을 입력해주세요.");
    return;
  }

  checkBtn.disabled = true;
  try {
    const studentRef = doc(db, "students", studentId);
    const studentSnap = await getDoc(studentRef);

    const name = studentsData[studentId] || (studentSnap.exists() ? studentSnap.data().studentName : null);

    if (!name) {
      alert("명렬표에서 해당 학번을 찾을 수 없습니다. 학번을 다시 확인해주세요.");
      resultBox.classList.add("hidden");
      return;
    }

    const count = studentSnap.exists() ? (studentSnap.data().count || 0) : 0;
    const penalty = Math.floor(count / 3);

    resultName.textContent = `${name} (${studentId})`;
    resultCount.textContent = `${count}회`;
    resultPenalty.textContent = penalty > 0 ? `${penalty}점` : "0점 (양호)";
    resultBox.classList.remove("hidden");
  } catch (err) {
    console.error(err);
    alert("조회 중 오류가 발생했습니다. 콘솔을 확인해주세요.");
  } finally {
    checkBtn.disabled = false;
  }
}

checkBtn.addEventListener("click", checkStudent);
studentIdInput.addEventListener("keydown", (e) => {
  if (e.key === "Enter") checkStudent();
});

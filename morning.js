// morning.js
import { db } from "./firebase.js";
import {
  collection,
  addDoc,
  deleteDoc,
  onSnapshot,
  getDocs,
  serverTimestamp,
} from "https://www.gstatic.com/firebasejs/11.9.1/firebase-firestore.js";

const studentIdInput = document.getElementById("studentId");
const studentNameInput = document.getElementById("studentName");
const saveBtn = document.getElementById("saveBtn");
const recordTable = document.getElementById("recordTable");
const deleteAllBtn = document.getElementById("deleteAll");
const reasonRadios = document.querySelectorAll('input[name="reason"]');
const customFields = document.getElementById("customFields");
const customReasonInput = document.getElementById("customReason");
const customScoreInput = document.getElementById("customScore");

// 급식선도(students 컬렉션)와 완전히 분리된 별도 컬렉션
const recordsCol = collection(db, "morning_records");

// "기타" 선택 시에만 직접 입력창 보이기
reasonRadios.forEach((radio) => {
  radio.addEventListener("change", () => {
    if (radio.value === "기타" && radio.checked) {
      customFields.classList.remove("hidden");
    } else {
      customFields.classList.add("hidden");
    }
  });
});

// 실시간으로 기록 표시 (최근 등록순)
onSnapshot(recordsCol, (snapshot) => {
  recordTable.innerHTML = "";

  const records = snapshot.docs
    .map((docSnap) => docSnap.data())
    .sort((a, b) => (b.createdAt?.seconds || 0) - (a.createdAt?.seconds || 0));

  records.forEach((data) => {
    const tr = document.createElement("tr");
    tr.innerHTML = `
      <td>${data.studentId}</td>
      <td>${data.studentName}</td>
      <td>${data.reason}</td>
      <td>${data.score}점</td>
    `;
    recordTable.appendChild(tr);
  });
});

// 등록 버튼
saveBtn.addEventListener("click", async () => {
  const studentId = studentIdInput.value.trim();
  const studentName = studentNameInput.value.trim();
  const selectedRadio = [...reasonRadios].find((r) => r.checked);

  if (!studentId || !studentName) {
    alert("학번과 이름을 모두 입력해주세요.");
    return;
  }

  let reason = selectedRadio.value;
  let score = Number(selectedRadio.dataset.score);

  if (selectedRadio.value === "기타") {
    reason = customReasonInput.value.trim();
    score = Number(customScoreInput.value);

    if (!reason || !score) {
      alert("사유와 점수를 모두 입력해주세요.");
      return;
    }
  }

  saveBtn.disabled = true;
  try {
    await addDoc(recordsCol, {
      studentId,
      studentName,
      reason,
      score,
      createdAt: serverTimestamp(),
    });

    studentIdInput.value = "";
    studentNameInput.value = "";
    customReasonInput.value = "";
    customScoreInput.value = "";
    studentIdInput.focus();
  } catch (err) {
    console.error(err);
    alert("등록 중 오류가 발생했습니다. 콘솔을 확인해주세요.");
  } finally {
    saveBtn.disabled = false;
  }
});

studentIdInput.addEventListener("keydown", (e) => {
  if (e.key === "Enter") studentNameInput.focus();
});
studentNameInput.addEventListener("keydown", (e) => {
  if (e.key === "Enter") saveBtn.click();
});

// 전체 삭제 (이 파트는 개별 삭제 없이 전체 삭제만 지원)
deleteAllBtn.addEventListener("click", async () => {
  const confirmDelete = confirm("전체 기록을 삭제하시겠습니까? 이 작업은 되돌릴 수 없습니다.");
  if (!confirmDelete) return;

  deleteAllBtn.disabled = true;
  try {
    const snapshot = await getDocs(recordsCol);
    await Promise.all(snapshot.docs.map((docSnap) => deleteDoc(docSnap.ref)));
  } catch (err) {
    console.error(err);
    alert("삭제 중 오류가 발생했습니다. 콘솔을 확인해주세요.");
  } finally {
    deleteAllBtn.disabled = false;
  }
});

// lunch.js
import { db } from "./firebase.js";
import {
  collection,
  doc,
  getDoc,
  setDoc,
  updateDoc,
  deleteDoc,
  onSnapshot,
  getDocs,
} from "https://www.gstatic.com/firebasejs/11.9.1/firebase-firestore.js";

const studentIdInput = document.getElementById("studentId");
const studentNameInput = document.getElementById("studentName");
const saveBtn = document.getElementById("saveBtn");
const studentTable = document.getElementById("studentTable");
const deleteAllBtn = document.getElementById("deleteAll");
const floatingAdjust = document.getElementById("floatingAdjust");
const floatingName = document.getElementById("floatingName");
const floatingMinus = document.getElementById("floatingMinus");
const floatingPlus = document.getElementById("floatingPlus");

const studentsCol = collection(db, "students");

let selectedStudentId = null;

function updateFloatingPanel() {
  if (selectedStudentId) {
    floatingAdjust.classList.remove("hidden");
  } else {
    floatingAdjust.classList.add("hidden");
    floatingName.textContent = "";
  }
}

// 실시간으로 학생 목록을 표에 렌더링
onSnapshot(studentsCol, (snapshot) => {
  studentTable.innerHTML = "";

  // 횟수 많은 순으로 정렬해서 보여주기
  const students = snapshot.docs
    .map((docSnap) => docSnap.data())
    .sort((a, b) => (b.count || 0) - (a.count || 0));

  students.forEach((data) => {
    const tr = document.createElement("tr");
    const penalty = Math.floor((data.count || 0) / 3);
    const isSelected = data.studentId === selectedStudentId;

    tr.innerHTML = `
      <td><input type="checkbox" class="selectCheck" data-id="${data.studentId}" data-name="${data.studentName}" ${isSelected ? "checked" : ""}></td>
      <td>${data.studentId}</td>
      <td>${data.studentName}</td>
      <td>${data.count}</td>
      <td class="${penalty > 0 ? "penaltyCell" : ""}">${penalty > 0 ? `벌점 ${penalty}점` : "-"}</td>
      <td><button class="deleteOneBtn" data-id="${data.studentId}">삭제</button></td>
    `;
    studentTable.appendChild(tr);
  });

  // 선택된 학생이 삭제되어 목록에 없으면 선택 해제
  if (selectedStudentId && !students.some((s) => s.studentId === selectedStudentId)) {
    selectedStudentId = null;
  }
  if (selectedStudentId) {
    const sel = students.find((s) => s.studentId === selectedStudentId);
    floatingName.textContent = sel ? `${sel.studentName} (${sel.studentId})` : "";
  }
  updateFloatingPanel();
});

// 체크박스 선택 (한 번에 한 명만 선택되도록)
studentTable.addEventListener("change", (e) => {
  if (!e.target.classList.contains("selectCheck")) return;

  if (e.target.checked) {
    selectedStudentId = e.target.dataset.id;
    floatingName.textContent = `${e.target.dataset.name} (${e.target.dataset.id})`;
    document.querySelectorAll(".selectCheck").forEach((cb) => {
      if (cb !== e.target) cb.checked = false;
    });
  } else {
    selectedStudentId = null;
  }
  updateFloatingPanel();
});

// 플로팅 패널의 -/+ 버튼: 선택된 학생의 횟수 조정
async function adjustSelected(delta) {
  if (!selectedStudentId) return;
  const studentRef = doc(db, "students", selectedStudentId);
  const studentSnap = await getDoc(studentRef);
  if (!studentSnap.exists()) return;
  const currentCount = studentSnap.data().count || 0;
  const newCount = Math.max(0, currentCount + delta);
  await updateDoc(studentRef, { count: newCount });
}

floatingMinus.addEventListener("click", () => adjustSelected(-1));
floatingPlus.addEventListener("click", () => adjustSelected(1));

// 등록 버튼: 이미 등록된 학번이면 횟수 +1, 없으면 새로 등록
saveBtn.addEventListener("click", async () => {
  const studentId = studentIdInput.value.trim();
  const studentName = studentNameInput.value.trim();

  if (!studentId || !studentName) {
    alert("학번과 이름을 모두 입력해주세요.");
    return;
  }

  saveBtn.disabled = true;

  try {
    const studentRef = doc(db, "students", studentId);
    const studentSnap = await getDoc(studentRef);

    if (studentSnap.exists()) {
      const currentCount = studentSnap.data().count || 0;
      await updateDoc(studentRef, {
        studentName,
        count: currentCount + 1,
      });
    } else {
      await setDoc(studentRef, {
        studentId,
        studentName,
        count: 1,
      });
    }

    studentIdInput.value = "";
    studentNameInput.value = "";
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

// 개별 삭제
studentTable.addEventListener("click", async (e) => {
  if (!e.target.classList.contains("deleteOneBtn")) return;

  const studentId = e.target.dataset.id;
  const confirmDelete = confirm(`학번 ${studentId} 학생을 삭제하시겠습니까?`);
  if (!confirmDelete) return;

  e.target.disabled = true;
  try {
    await deleteDoc(doc(db, "students", studentId));
    if (selectedStudentId === studentId) selectedStudentId = null;
  } catch (err) {
    console.error(err);
    alert("삭제 중 오류가 발생했습니다. 콘솔을 확인해주세요.");
    e.target.disabled = false;
  }
});

// 전체 삭제
deleteAllBtn.addEventListener("click", async () => {
  const confirmDelete = confirm("전체 학생 목록을 삭제하시겠습니까? 이 작업은 되돌릴 수 없습니다.");
  if (!confirmDelete) return;

  deleteAllBtn.disabled = true;
  try {
    const snapshot = await getDocs(studentsCol);
    await Promise.all(snapshot.docs.map((docSnap) => deleteDoc(docSnap.ref)));
    selectedStudentId = null;
    updateFloatingPanel();
  } catch (err) {
    console.error(err);
    alert("삭제 중 오류가 발생했습니다. 콘솔을 확인해주세요.");
  } finally {
    deleteAllBtn.disabled = false;
  }
});

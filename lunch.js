// lunch.js
import { db } from "./firebase.js";
import { studentsData } from "./students-data.js";
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

  const students = snapshot.docs
    .map((docSnap) => docSnap.data())
    .sort((a, b) => (b.count || 0) - (a.count || 0));

  students.forEach((data) => {
    const tr = document.createElement("tr");
    const penalty = Math.floor((data.count || 0) / 3) * 2;
    const isSelected = data.studentId === selectedStudentId;

    tr.innerHTML = `
      <td><input type="checkbox" class="selectCheck" data-id="${data.studentId}" data-name="${data.studentName}" ${isSelected ? "checked" : ""}></td>
      <td>${data.studentId}</td>
<td>${data.studentName}</td>
<td>${data.count}</td>
<td class="${penalty > 0 ? "penaltyCell" : ""}">
    ${penalty > 0 ? `벌점 ${penalty}점` : "-"}
</td>
<td>
    ${
      penalty > 0
        ? `<button class="deleteOneBtn processBtn" data-id="${data.studentId}">부여</button>`
        : "-"
    }
</td>
    `;
    studentTable.appendChild(tr);
  });

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

studentIdInput.addEventListener("input", () => {
  const sid = studentIdInput.value.trim();
  if (studentsData[sid]) {
    studentNameInput.value = studentsData[sid];
  }
});

// 벌점 부여
studentTable.addEventListener("click", async (e) => {
  if (!e.target.classList.contains("processBtn")) return;

  const studentId = e.target.dataset.id;

  const studentRef = doc(db, "students", studentId);
  const studentSnap = await getDoc(studentRef);

  if (!studentSnap.exists()) return;

  const currentCount = studentSnap.data().count || 0;
  const penalty = Math.floor(currentCount / 3) * 2;

  if (penalty === 0) return;

  const remain = currentCount % 3;

  const ok = confirm(
    `${studentSnap.data().studentName} 학생에게 벌점 ${penalty}점을 부여하시겠습니까?\n\n처리 후 남는 횟수 : ${remain}회`
  );

  if (!ok) return;

  await updateDoc(studentRef, {
    count: remain
  });

  alert("벌점이 부여되었습니다.");
});

// 전체 삭제 (비밀번호 확인 필요)
const DELETE_PASSWORD = "0531";

deleteAllBtn.addEventListener("click", async () => {
  const inputPw = prompt("전체 삭제 비밀번호를 입력하세요.");
  if (inputPw === null) return;
  if (inputPw !== DELETE_PASSWORD) {
    alert("비밀번호가 틀렸습니다.");
    return;
  }

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

// app.js
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

const studentsCol = collection(db, "students");

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
    tr.innerHTML = `
      <td>${data.studentId}</td>
      <td>${data.studentName}</td>
      <td>${data.count}</td>
      <td class="${penalty > 0 ? "penaltyCell" : ""}">${penalty > 0 ? `벌점 ${penalty}점` : "-"}</td>
      <td><button class="deleteOneBtn" data-id="${data.studentId}">삭제</button></td>
    `;
    studentTable.appendChild(tr);
  });
});

// 개별 삭제 (표 안의 삭제 버튼 클릭 시)
studentTable.addEventListener("click", async (e) => {
  if (!e.target.classList.contains("deleteOneBtn")) return;

  const studentId = e.target.dataset.id;
  const confirmDelete = confirm(`학번 ${studentId} 학생을 삭제하시겠습니까?`);
  if (!confirmDelete) return;

  e.target.disabled = true;
  try {
    await deleteDoc(doc(db, "students", studentId));
  } catch (err) {
    console.error(err);
    alert("삭제 중 오류가 발생했습니다. 콘솔을 확인해주세요.");
    e.target.disabled = false;
  }
});

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
        studentName, // 이름이 바뀐 경우 최신 이름으로 갱신
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

// 학번 입력창에서 Enter 치면 바로 등록
studentIdInput.addEventListener("keydown", (e) => {
  if (e.key === "Enter") studentNameInput.focus();
});
studentNameInput.addEventListener("keydown", (e) => {
  if (e.key === "Enter") saveBtn.click();
});

// 전체 삭제
deleteAllBtn.addEventListener("click", async () => {
  const confirmDelete = confirm("전체 학생 목록을 삭제하시겠습니까? 이 작업은 되돌릴 수 없습니다.");
  if (!confirmDelete) return;

  deleteAllBtn.disabled = true;
  try {
    const snapshot = await getDocs(studentsCol);
    await Promise.all(snapshot.docs.map((docSnap) => deleteDoc(docSnap.ref)));
  } catch (err) {
    console.error(err);
    alert("삭제 중 오류가 발생했습니다. 콘솔을 확인해주세요.");
  } finally {
    deleteAllBtn.disabled = false;
  }
});

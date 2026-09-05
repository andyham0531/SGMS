// admin.js
import { db } from "./firebase.js";
import {
  collection,
  doc,
  addDoc,
  setDoc,
  getDoc,
  updateDoc,
  deleteDoc,
  onSnapshot,
} from "https://www.gstatic.com/firebasejs/11.9.1/firebase-firestore.js";

const ADMIN_PASSWORD = "1234";

const gate = document.getElementById("gate");
const adminContent = document.getElementById("adminContent");
const pwInput = document.getElementById("pwInput");
const pwBtn = document.getElementById("pwBtn");

function unlock() {
  gate.classList.add("hidden");
  adminContent.classList.remove("hidden");
  initAdmin();
}

pwBtn.addEventListener("click", () => {
  if (pwInput.value === ADMIN_PASSWORD) {
    unlock();
  } else {
    alert("비밀번호가 틀렸습니다.");
    pwInput.value = "";
  }
});
pwInput.addEventListener("keydown", (e) => {
  if (e.key === "Enter") pwBtn.click();
});

let initialized = false;

function initAdmin() {
  if (initialized) return;
  initialized = true;

  // ===== 우산 담당자 관리 =====
  const managersCol = collection(db, "umbrella_managers");
  const managerList = document.getElementById("managerList");
  const newManagerName = document.getElementById("newManagerName");
  const newManagerPhone = document.getElementById("newManagerPhone");
  const addManagerBtn = document.getElementById("addManagerBtn");

  onSnapshot(managersCol, (snapshot) => {
    const managers = snapshot.docs.map((d) => ({ id: d.id, ...d.data() }));
    managerList.innerHTML = managers.length
      ? managers.map((m) => `
          <div class="adminRow">
            <input type="text" value="${escapeAttr(m.name)}" data-field="name" data-id="${m.id}" data-type="manager" style="flex:1;">
            <input type="text" value="${escapeAttr(m.phone || "")}" data-field="phone" data-id="${m.id}" data-type="manager" style="flex:1;">
            <div class="adminRowBtns">
              <button class="adminSaveBtn" data-save-manager="${m.id}">저장</button>
              <button class="adminDeleteBtn" data-delete-manager="${m.id}">삭제</button>
            </div>
          </div>
        `).join("")
      : `<p class="emptyMsg">등록된 담당자가 없어요</p>`;
  });

  addManagerBtn.addEventListener("click", async () => {
    const name = newManagerName.value.trim();
    const phone = newManagerPhone.value.trim();
    if (!name) {
      alert("이름을 입력해주세요.");
      return;
    }
    await addDoc(managersCol, { name, phone });
    newManagerName.value = "";
    newManagerPhone.value = "";
  });

  managerList.addEventListener("click", async (e) => {
    const saveId = e.target.dataset.saveManager;
    const delId = e.target.dataset.deleteManager;

    if (saveId) {
      const row = e.target.closest(".adminRow");
      const name = row.querySelector('[data-field="name"]').value.trim();
      const phone = row.querySelector('[data-field="phone"]').value.trim();
      if (!name) {
        alert("이름은 비울 수 없어요.");
        return;
      }
      await updateDoc(doc(db, "umbrella_managers", saveId), { name, phone });
      alert("저장되었습니다.");
    }

    if (delId) {
      const ok = confirm("이 담당자를 삭제하시겠습니까?");
      if (!ok) return;
      await deleteDoc(doc(db, "umbrella_managers", delId));
    }
  });

  // ===== 급식선도 학생 데이터 관리 =====
  const studentsCol = collection(db, "students");
  const studentList = document.getElementById("studentList");
  const newStudentId = document.getElementById("newStudentId");
  const newStudentName = document.getElementById("newStudentName");
  const newStudentCount = document.getElementById("newStudentCount");
  const addStudentBtn = document.getElementById("addStudentBtn");

  onSnapshot(studentsCol, (snapshot) => {
    const students = snapshot.docs
      .map((d) => ({ id: d.id, ...d.data() }))
      .sort((a, b) => a.id.localeCompare(b.id));

    studentList.innerHTML = students.length
      ? students.map((s) => `
          <div class="adminRow">
            <span class="studentIdTag">${escapeAttr(s.studentId || s.id)}</span>
            <input type="text" value="${escapeAttr(s.studentName || "")}" data-field="studentName" data-id="${s.id}" style="flex:1;">
            <input type="number" value="${s.count || 0}" data-field="count" data-id="${s.id}" style="width:60px; flex:none;">
            <div class="adminRowBtns">
              <button class="adminSaveBtn" data-save-student="${s.id}">저장</button>
              <button class="adminDeleteBtn" data-delete-student="${s.id}">삭제</button>
            </div>
          </div>
        `).join("")
      : `<p class="emptyMsg">등록된 학생 데이터가 없어요</p>`;
  });

  addStudentBtn.addEventListener("click", async () => {
    const studentId = newStudentId.value.trim();
    const studentName = newStudentName.value.trim();
    const count = Number(newStudentCount.value) || 0;
    if (!studentId || !studentName) {
      alert("학번과 이름을 입력해주세요.");
      return;
    }
    const studentRef = doc(db, "students", studentId);
    const existing = await getDoc(studentRef);
    if (existing.exists()) {
      await updateDoc(studentRef, { studentName, count });
    } else {
      await setDoc(studentRef, { studentId, studentName, count });
    }
    newStudentId.value = "";
    newStudentName.value = "";
    newStudentCount.value = "";
  });

  studentList.addEventListener("click", async (e) => {
    const saveId = e.target.dataset.saveStudent;
    const delId = e.target.dataset.deleteStudent;

    if (saveId) {
      const row = e.target.closest(".adminRow");
      const studentName = row.querySelector('[data-field="studentName"]').value.trim();
      const count = Number(row.querySelector('[data-field="count"]').value) || 0;
      if (!studentName) {
        alert("이름은 비울 수 없어요.");
        return;
      }
      await updateDoc(doc(db, "students", saveId), { studentName, count });
      alert("저장되었습니다.");
    }

    if (delId) {
      const ok = confirm("이 학생 데이터를 삭제하시겠습니까?");
      if (!ok) return;
      await deleteDoc(doc(db, "students", delId));
    }
  });

  // ===== 마이너스 처리 로그 =====
  const logsCol = collection(db, "admin_logs");
  const logList = document.getElementById("logList");

  onSnapshot(logsCol, (snapshot) => {
    const logs = snapshot.docs
      .map((d) => d.data())
      .sort((a, b) => (b.createdAt?.seconds || 0) - (a.createdAt?.seconds || 0));

    logList.innerHTML = logs.length
      ? logs.map((l) => {
          const date = l.createdAt?.toDate ? l.createdAt.toDate() : null;
          const dateStr = date
            ? `${date.getMonth() + 1}/${date.getDate()} ${String(date.getHours()).padStart(2, "0")}:${String(date.getMinutes()).padStart(2, "0")}`
            : "";
          return `
            <div class="logItem">
              ${escapeAttr(l.studentName)} (${escapeAttr(l.studentId)}) — ${l.delta > 0 ? "+" : ""}${l.delta}회 처리
              <div class="logMeta">${escapeAttr(l.source || "")} · 처리 후 ${l.countAfter}회 · ${dateStr}</div>
            </div>
          `;
        }).join("")
      : `<p class="emptyMsg">기록된 로그가 없어요</p>`;
  });
}

function escapeAttr(str) {
  const div = document.createElement("div");
  div.textContent = str ?? "";
  return div.innerHTML;
}

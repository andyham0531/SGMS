// umbrella_records.js
import { db } from "./firebase.js";
import {
  collection,
  getDocs,
  deleteDoc,
  query,
  orderBy,
} from "https://www.gstatic.com/firebasejs/11.9.1/firebase-firestore.js";

const recordsBody = document.getElementById("recordsBody");
const emptyMsg = document.getElementById("emptyMsg");
const deleteAllBtn = document.getElementById("deleteAllBtn");

const recordCol = collection(db, "umbrella_records");

function formatDate(time) {
  if (!time) return "-";
  const date = time.toDate ? time.toDate() : new Date(time);
  const mm = String(date.getMonth() + 1).padStart(2, "0");
  const dd = String(date.getDate()).padStart(2, "0");
  return `${mm}-${dd}`;
}

async function loadRecords() {
  recordsBody.innerHTML = "";
  emptyMsg.classList.add("hidden");

  const q = query(recordCol, orderBy("rentDate", "asc"));
  const snapshot = await getDocs(q);

  if (snapshot.empty) {
    emptyMsg.classList.remove("hidden");
    return;
  }

  let serial = 1;
  snapshot.forEach((docSnap) => {
    const data = docSnap.data();

    // 분실/대여중 상태는 반납일·연체여부를 '-'로 표시
    const isLost = data.status === "분실";
    const isActive = data.status === "대여중";

    const rentStr = formatDate(data.rentDate);
    const returnStr = isLost ? "분실" : formatDate(data.returnDate);
    const overdueStr =
      isLost || isActive
        ? "-"
        : data.isOverdue
        ? `O (${data.overdueDays}일)`
        : "X";

    const tr = document.createElement("tr");
    tr.innerHTML = `
      <td>${serial}</td>
      <td>${data.studentId || "-"}</td>
      <td>${data.studentName || "-"}</td>
      <td>${data.umbrellaNumber || "-"}번</td>
      <td>${rentStr}</td>
      <td>${returnStr}</td>
      <td>${overdueStr}</td>
      <td>${
        data.signature
          ? `<img src="${data.signature}" class="signatureThumb" alt="서명">`
          : "-"
      }</td>
    `;
    recordsBody.appendChild(tr);
    serial++;
  });
}

loadRecords();

// 전체 삭제 (비밀번호 없이 확인창만)
deleteAllBtn.addEventListener("click", async () => {
  const confirmDelete = confirm("대여 이력을 전체 삭제하시겠습니까? 이 작업은 되돌릴 수 없습니다.");
  if (!confirmDelete) return;

  deleteAllBtn.disabled = true;
  try {
    const snapshot = await getDocs(recordCol);
    await Promise.all(snapshot.docs.map((docSnap) => deleteDoc(docSnap.ref)));
    loadRecords();
  } catch (err) {
    console.error(err);
    alert("삭제 중 오류가 발생했습니다. 콘솔을 확인해주세요.");
  } finally {
    deleteAllBtn.disabled = false;
  }
});

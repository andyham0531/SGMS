// umbrella_records.js
import { db } from "./firebase.js";
import {
  collection,
  getDocs,
  query,
  orderBy,
} from "https://www.gstatic.com/firebasejs/11.9.1/firebase-firestore.js";

const recordsBody = document.getElementById("recordsBody");
const emptyMsg = document.getElementById("emptyMsg");

function formatDate(time) {
  if (!time) return "-";
  const date = time.toDate ? time.toDate() : new Date(time);
  const mm = String(date.getMonth() + 1).padStart(2, "0");
  const dd = String(date.getDate()).padStart(2, "0");
  return `${mm}-${dd}`;
}

async function loadRecords() {
  const recordCol = collection(db, "umbrella_records");
  const q = query(recordCol, orderBy("rentDate", "asc"));
  const snapshot = await getDocs(q);

  if (snapshot.empty) {
    emptyMsg.classList.remove("hidden");
    return;
  }

  let serial = 1;
  snapshot.forEach((docSnap) => {
    const data = docSnap.data();

    // 분실 기록은 반납일 없이 상태만 표시
    const isLost = data.status === "분실";

    const rentStr = formatDate(data.rentDate);
    const returnStr = isLost ? "분실" : formatDate(data.returnDate);
    const overdueStr = isLost
      ? "-"
      : data.isOverdue
      ? `O (${data.overdueDays}일)`
      : "X";

    const tr = document.createElement("tr");
    tr.innerHTML = `
      <td>${serial}</td>
      <td>${data.studentId || "-"}</td>
      <td>${data.studentName || "-"}</td>
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

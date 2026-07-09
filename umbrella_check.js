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
  serverTimestamp,
} from "https://www.gstatic.com/firebasejs/11.9.1/firebase-firestore.js";

const TOTAL_UMBRELLAS = 15;
const OVERDUE_DAYS = 3;
const BAN_DAYS = 30;

const umbrellaCol = collection(db, "umbrellas");
const recordCol = collection(db, "umbrella_records");

function getManager(number) {
  if (number <= 5) return { name: "박나은", phone: "010-7188-2462" };
  if (number <= 10) return { name: "백승주", phone: "010-5716-1236" };
  return { name: "이윤빈", phone: "010-5109-1236" };
}

function smsHref(phone) {
  return "sms:" + phone.replace(/-/g, "");
}

function getPassedDays(time) {
  if (!time) return 0;
  const date = time.toDate ? time.toDate() : new Date(time);
  return Math.floor((Date.now() - date.getTime()) / 86400000);
}

async function copyText(text) {
  try {
    await navigator.clipboard.writeText(text);
    alert("메시지가 복사되었습니다! 문자/카카오톡에 붙여넣어 보내주세요.");
  } catch (err) {
    alert("복사에 실패했어요. 아래 문구를 직접 선택해서 복사해주세요:\n\n" + text);
  }
}

// ===== 모드 전환 =====
const modeRentBtn = document.getElementById("modeRentBtn");
const modeReturnBtn = document.getElementById("modeReturnBtn");
const rentFlow = document.getElementById("rentFlow");
const returnFlow = document.getElementById("returnFlow");

modeRentBtn.addEventListener("click", () => {
  modeRentBtn.classList.add("active");
  modeReturnBtn.classList.remove("active");
  rentFlow.classList.remove("hidden");
  returnFlow.classList.add("hidden");
});

modeReturnBtn.addEventListener("click", () => {
  modeReturnBtn.classList.add("active");
  modeRentBtn.classList.remove("active");
  returnFlow.classList.remove("hidden");
  rentFlow.classList.add("hidden");
});

// =====================================================
// 대여 플로우
// =====================================================
const rentStudentIdInput = document.getElementById("rentStudentId");
const rentStudentNameInput = document.getElementById("rentStudentName");
const rentUmbrellaSelect = document.getElementById("rentUmbrellaSelect");

const rentStep2 = document.getElementById("rentStep2");
const rentManagerInfo = document.getElementById("rentManagerInfo");
const rentMessageBox = document.getElementById("rentMessageBox");
const rentCopyBtn = document.getElementById("rentCopyBtn");
const rentSmsLink = document.getElementById("rentSmsLink");

const rentStep3 = document.getElementById("rentStep3");
const rentSignaturePad = document.getElementById("rentSignaturePad");
const clearRentSignatureBtn = document.getElementById("clearRentSignature");
const confirmRentBtn = document.getElementById("confirmRentBtn");
const rentSigCtx = rentSignaturePad.getContext("2d");
let hasRentSignature = false;
let hasCopiedRent = false;

rentStudentIdInput.addEventListener("input", () => {
  const id = rentStudentIdInput.value.trim();
  if (studentsData[id]) {
    rentStudentNameInput.value = studentsData[id];
  }
  validateRentStep1();
});
rentStudentNameInput.addEventListener("input", validateRentStep1);
rentUmbrellaSelect.addEventListener("change", validateRentStep1);

async function loadAvailableUmbrellas() {
  const snapshot = await getDocs(umbrellaCol);
  const umbrellaData = {};
  snapshot.forEach((docSnap) => {
    umbrellaData[docSnap.id] = docSnap.data();
  });

  rentUmbrellaSelect.innerHTML = '<option value="">우산 번호 선택</option>';
  for (let i = 1; i <= TOTAL_UMBRELLAS; i++) {
    const data = umbrellaData[i];
    const isAvailable = !data || !data.status || data.status === "대여가능";
    const opt = document.createElement("option");
    opt.value = i;
    opt.textContent = isAvailable ? `${i}번 (대여가능)` : `${i}번 (${data.status})`;
    if (!isAvailable) opt.disabled = true;
    rentUmbrellaSelect.appendChild(opt);
  }
}
loadAvailableUmbrellas();

function validateRentStep1() {
  const id = rentStudentIdInput.value.trim();
  const name = rentStudentNameInput.value.trim();
  const number = rentUmbrellaSelect.value;

  if (!id || !name || !number) {
    rentStep2.classList.add("hidden");
    rentStep3.classList.add("hidden");
    hasCopiedRent = false;
    return;
  }

  const manager = getManager(Number(number));
  rentManagerInfo.textContent = `${manager.name} 담당 · ${manager.phone}`;
  rentMessageBox.value = `${id} ${name} ${number}번 우산 대여합니다`;
  rentSmsLink.href = smsHref(manager.phone);
  rentStep2.classList.remove("hidden");

  // 학번/이름/번호가 바뀌면 복사 절차부터 다시
  hasCopiedRent = false;
  rentStep3.classList.add("hidden");
}

rentCopyBtn.addEventListener("click", async () => {
  await copyText(rentMessageBox.value);
  hasCopiedRent = true;
  rentSigCtx.clearRect(0, 0, rentSignaturePad.width, rentSignaturePad.height);
  hasRentSignature = false;
  rentStep3.classList.remove("hidden");
});

// 서명 캔버스
function setupSignaturePad(canvas, ctx, onDraw) {
  function getPos(e) {
    const rect = canvas.getBoundingClientRect();
    const clientX = e.touches ? e.touches[0].clientX : e.clientX;
    const clientY = e.touches ? e.touches[0].clientY : e.clientY;
    return { x: clientX - rect.left, y: clientY - rect.top };
  }
  let drawing = false;
  function startDraw(e) {
    drawing = true;
    onDraw(true);
    const pos = getPos(e);
    ctx.beginPath();
    ctx.moveTo(pos.x, pos.y);
    e.preventDefault();
  }
  function draw(e) {
    if (!drawing) return;
    const pos = getPos(e);
    ctx.lineTo(pos.x, pos.y);
    ctx.strokeStyle = "#1b2a4a";
    ctx.lineWidth = 2;
    ctx.lineCap = "round";
    ctx.stroke();
    e.preventDefault();
  }
  function endDraw() {
    drawing = false;
  }
  canvas.addEventListener("mousedown", startDraw);
  canvas.addEventListener("mousemove", draw);
  canvas.addEventListener("mouseup", endDraw);
  canvas.addEventListener("mouseleave", endDraw);
  canvas.addEventListener("touchstart", startDraw);
  canvas.addEventListener("touchmove", draw);
  canvas.addEventListener("touchend", endDraw);
}
setupSignaturePad(rentSignaturePad, rentSigCtx, (v) => (hasRentSignature = v));

clearRentSignatureBtn.addEventListener("click", () => {
  rentSigCtx.clearRect(0, 0, rentSignaturePad.width, rentSignaturePad.height);
  hasRentSignature = false;
});

confirmRentBtn.addEventListener("click", async () => {
  if (!hasCopiedRent) {
    alert("먼저 담당자에게 메시지를 복사해서 보내주세요.");
    return;
  }
  if (!hasRentSignature) {
    const skip = confirm("서명이 없습니다. 서명 없이 진행하시겠습니까?");
    if (!skip) return;
  }

  const id = rentStudentIdInput.value.trim();
  const name = rentStudentNameInput.value.trim();
  const number = Number(rentUmbrellaSelect.value);
  const manager = getManager(number);

  confirmRentBtn.disabled = true;
  try {
    await setDoc(doc(db, "umbrellas", String(number)), {
      number,
      status: "대여중",
      studentId: id,
      studentName: name,
      manager: manager.name,
      agreementSignature: hasRentSignature ? rentSignaturePad.toDataURL("image/png") : "",
      rentDate: serverTimestamp(),
    });

    alert(`${number}번 우산 대여가 완료되었습니다! 잊지 말고 ${manager.name} 담당자에게 문자 보내는 것도 확인해주세요.`);

    rentStudentIdInput.value = "";
    rentStudentNameInput.value = "";
    rentUmbrellaSelect.value = "";
    rentStep2.classList.add("hidden");
    rentStep3.classList.add("hidden");
    hasCopiedRent = false;
    loadAvailableUmbrellas();
  } finally {
    confirmRentBtn.disabled = false;
  }
});

// =====================================================
// 반납 플로우
// =====================================================
const returnStudentIdInput = document.getElementById("returnStudentId");
const returnStudentNameInput = document.getElementById("returnStudentName");
const findReturnBtn = document.getElementById("findReturnBtn");

const returnStep2 = document.getElementById("returnStep2");
const returnFoundTitle = document.getElementById("returnFoundTitle");
const returnManagerInfo = document.getElementById("returnManagerInfo");
const returnMessageBox = document.getElementById("returnMessageBox");
const returnCopyBtn = document.getElementById("returnCopyBtn");
const returnSmsLink = document.getElementById("returnSmsLink");

const returnStep3 = document.getElementById("returnStep3");
const returnPhotoInput = document.getElementById("returnPhotoInput");
const sendPhotoBtn = document.getElementById("sendPhotoBtn");

const returnStep4 = document.getElementById("returnStep4");
const finalReturnBtn = document.getElementById("finalReturnBtn");

const returnBanMsg = document.getElementById("returnBanMsg");

let currentReturnNumber = null;
let currentReturnData = null;
let hasCopiedReturn = false;
let hasSentPhoto = false;

returnStudentIdInput.addEventListener("input", () => {
  const id = returnStudentIdInput.value.trim();
  if (studentsData[id]) {
    returnStudentNameInput.value = studentsData[id];
  }
});

findReturnBtn.addEventListener("click", async () => {
  const id = returnStudentIdInput.value.trim();
  const name = returnStudentNameInput.value.trim();

  if (!id || !name) {
    alert("학번과 이름을 모두 입력해주세요.");
    return;
  }

  returnStep2.classList.add("hidden");
  returnStep3.classList.add("hidden");
  returnStep4.classList.add("hidden");
  returnBanMsg.classList.add("hidden");
  hasCopiedReturn = false;
  hasSentPhoto = false;

  findReturnBtn.disabled = true;
  try {
    const snapshot = await getDocs(umbrellaCol);
    let found = null;
    let foundNumber = null;

    snapshot.forEach((docSnap) => {
      const data = docSnap.data();
      if (data.studentId === id && data.status === "대여중") {
        found = data;
        foundNumber = docSnap.id;
      }
    });

    if (!found) {
      alert("현재 대여중인 우산이 없습니다.");
      return;
    }

    currentReturnNumber = foundNumber;
    currentReturnData = found;

    const manager = getManager(Number(foundNumber));
    const days = getPassedDays(found.rentDate);

    returnFoundTitle.textContent = `${foundNumber}번 우산 · ${days}일째 대여중`;
    returnManagerInfo.textContent = `${manager.name} 담당 · ${manager.phone}`;
    returnMessageBox.value = `${id} ${name} ${foundNumber}번 우산 반납합니다`;
    returnSmsLink.href = smsHref(manager.phone);

    returnStep2.classList.remove("hidden");
  } finally {
    findReturnBtn.disabled = false;
  }
});

returnCopyBtn.addEventListener("click", async () => {
  await copyText(returnMessageBox.value);
  hasCopiedReturn = true;
  returnPhotoInput.value = "";
  returnStep3.classList.remove("hidden");
});

sendPhotoBtn.addEventListener("click", async () => {
  const file = returnPhotoInput.files[0];
  if (!file) {
    alert("반납 사진을 먼저 첨부해주세요.");
    return;
  }

  const manager = getManager(Number(currentReturnNumber));
  const shareText = returnMessageBox.value;

  try {
    if (navigator.canShare && navigator.canShare({ files: [file] })) {
      await navigator.share({ files: [file], text: shareText });
    } else {
      alert("이 기기에서는 사진 자동 공유가 지원되지 않아요.\n카카오톡/문자로 직접 사진을 보내주세요: " + manager.name + " " + manager.phone);
    }
  } catch (err) {
    // 공유 취소해도 다음 단계로는 진행 가능
  }

  hasSentPhoto = true;
  returnStep4.classList.remove("hidden");
});

finalReturnBtn.addEventListener("click", async () => {
  if (!hasCopiedReturn) {
    alert("먼저 담당자에게 메시지를 복사해서 보내주세요.");
    return;
  }
  if (!hasSentPhoto) {
    alert("먼저 반납 사진을 담당자에게 보내주세요.");
    return;
  }

  finalReturnBtn.disabled = true;
  try {
    const overdueDays = getPassedDays(currentReturnData.rentDate);
    const isOverdue = overdueDays >= OVERDUE_DAYS;

    await setDoc(doc(db, "umbrellas", String(currentReturnNumber)), {
      number: Number(currentReturnNumber),
      status: "대여가능",
    });

    await addDoc(recordCol, {
      umbrellaNumber: Number(currentReturnNumber),
      studentId: currentReturnData.studentId,
      studentName: currentReturnData.studentName,
      manager: getManager(Number(currentReturnNumber)).name,
      rentDate: currentReturnData.rentDate || null,
      returnDate: serverTimestamp(),
      overdueDays: isOverdue ? overdueDays : 0,
      isOverdue,
      banUntil: isOverdue ? new Date(Date.now() + BAN_DAYS * 86400000) : null,
      signature: "",
      status: "반납완료",
    });

    if (isOverdue) {
      alert(`반납 처리되었습니다.\n연체(${overdueDays}일)로 인해 ${BAN_DAYS}일간 대여가 제한됩니다.`);
    } else {
      alert("반납이 완료되었습니다. 감사합니다!");
    }

    returnStudentIdInput.value = "";
    returnStudentNameInput.value = "";
    returnStep2.classList.add("hidden");
    returnStep3.classList.add("hidden");
    returnStep4.classList.add("hidden");
    currentReturnNumber = null;
    currentReturnData = null;
    hasCopiedReturn = false;
    hasSentPhoto = false;
  } finally {
    finalReturnBtn.disabled = false;
  }
});

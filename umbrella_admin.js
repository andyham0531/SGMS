// ===== Firebase 설정 (기존 lunch.html/morning.html과 동일한 프로젝트 설정 사용) =====
const firebaseConfig = {
  apiKey: "여기에_기존_설정값_입력",
  authDomain: "여기에_기존_설정값_입력",
  projectId: "여기에_기존_설정값_입력",
  storageBucket: "여기에_기존_설정값_입력",
  messagingSenderId: "여기에_기존_설정값_입력",
  appId: "여기에_기존_설정값_입력"
};

firebase.initializeApp(firebaseConfig);
const db = firebase.firestore();
const storage = firebase.storage();

// ===== 기본 설정 =====
const TOTAL_UMBRELLAS = 15; // 시범 운영 15개 (1~15번)
const OVERDUE_DAYS = 3;
const LOST_FINE = 5000;

let currentManager = null;
let currentUmbrellaNumber = null;
let umbrellaData = {}; // { 번호: { status, renterName, studentId, rentDate, recordId } }
let selectedPhotoFile = null;

// ===== 담당자 선택 =====
document.querySelectorAll('.manager-select button').forEach(btn => {
  btn.addEventListener('click', () => {
    document.querySelectorAll('.manager-select button').forEach(b => b.classList.remove('active'));
    btn.classList.add('active');
    currentManager = btn.dataset.name;
  });
});

// ===== 그리드 렌더링 =====
function renderGrid() {
  const grid = document.getElementById('grid');
  grid.innerHTML = '';
  for (let i = 1; i <= TOTAL_UMBRELLAS; i++) {
    const data = umbrellaData[i] || { status: '가능' };
    const card = document.createElement('div');
    let cardClass = 'card available';
    let statusText = '대여가능';

    if (data.status === '대여중') {
      const days = daysSince(data.rentDate);
      if (days >= OVERDUE_DAYS) {
        cardClass = 'card overdue';
        statusText = `${data.renterName} · ${days}일 경과`;
      } else {
        cardClass = 'card rented';
        statusText = `${data.renterName} · ${days}일째`;
      }
    } else if (data.status === '분실') {
      cardClass = 'card lost';
      statusText = '분실';
    }

    card.className = cardClass;
    card.innerHTML = `<div class="num">${i}번</div><div class="status">${statusText}</div>`;
    card.onclick = () => handleCardClick(i, data);
    grid.appendChild(card);
  }
  renderOverdueList();
}

function daysSince(timestamp) {
  if (!timestamp) return 0;
  const rentDate = timestamp.toDate ? timestamp.toDate() : new Date(timestamp);
  const diffMs = Date.now() - rentDate.getTime();
  return Math.floor(diffMs / (1000 * 60 * 60 * 24));
}

function handleCardClick(number, data) {
  if (!currentManager) {
    alert('먼저 상단에서 담당자를 선택해주세요!');
    return;
  }
  currentUmbrellaNumber = number;
  if (!data.status || data.status === '가능') {
    openRentModal(number);
  } else if (data.status === '대여중') {
    openReturnModal(number, data);
  } else {
    alert('분실 처리된 우산입니다. 관리자와 상의해주세요.');
  }
}

// ===== 미납 3일 경과 목록 =====
function renderOverdueList() {
  const box = document.getElementById('overdueBox');
  const list = document.getElementById('overdueList');
  list.innerHTML = '';
  let hasOverdue = false;

  Object.entries(umbrellaData).forEach(([num, data]) => {
    if (data.status === '대여중') {
      const days = daysSince(data.rentDate);
      if (days >= OVERDUE_DAYS) {
        hasOverdue = true;
        const item = document.createElement('div');
        item.className = 'overdue-item';
        item.innerHTML = `
          <span>${num}번 · ${data.renterName} (${data.studentId}) · ${days}일 경과</span>
          <button onclick="sendReminder('${num}', '${data.renterName}', ${days})">알림 보내기</button>
        `;
        list.appendChild(item);
      }
    }
  });

  box.className = hasOverdue ? 'overdue-box show' : 'overdue-box';
}

// 원클릭 카톡/문자 공유 (완전 자동 푸시는 무료로 불가하여 담당자가 클릭 한 번으로 발송)
function sendReminder(num, name, days) {
  const message = `[다원 우산대여 알림]\n${name}님, ${num}번 우산 대여일이 ${days}일 지났어요!\n빠른 반납 부탁드립니다 🙏\n(3일 이상 미반납 시 다음 대여가 제한됩니다)`;

  if (navigator.share) {
    navigator.share({ text: message }).catch(() => {
      copyToClipboard(message);
    });
  } else {
    copyToClipboard(message);
  }
}

function copyToClipboard(text) {
  navigator.clipboard.writeText(text).then(() => {
    alert('알림 문구가 복사되었습니다! 카카오톡에 붙여넣어 전송해주세요.');
  });
}

// ===== 대여 모달 =====
function openRentModal(number) {
  document.getElementById('rentModalTitle').textContent = `${number}번 우산 대여`;
  document.getElementById('rentStudentId').value = '';
  document.getElementById('rentName').value = '';
  document.getElementById('rentAutocomplete').style.display = 'none';
  document.getElementById('rentModalBg').classList.add('show');
}

// 학번 자동완성 (students-data.js의 studentsData 배열/객체 활용)
document.getElementById('rentStudentId').addEventListener('input', function() {
  const val = this.value.trim();
  const list = document.getElementById('rentAutocomplete');
  list.innerHTML = '';
  if (!val || typeof studentsData === 'undefined') {
    list.style.display = 'none';
    return;
  }
  const matches = studentsData.filter(s => s.id.startsWith(val)).slice(0, 8);
  if (matches.length === 0) {
    list.style.display = 'none';
    return;
  }
  matches.forEach(s => {
    const div = document.createElement('div');
    div.textContent = `${s.id} ${s.name}`;
    div.onclick = () => {
      document.getElementById('rentStudentId').value = s.id;
      document.getElementById('rentName').value = s.name;
      list.style.display = 'none';
    };
    list.appendChild(div);
  });
  list.style.display = 'block';
});

async function submitRent() {
  const studentId = document.getElementById('rentStudentId').value.trim();
  const name = document.getElementById('rentName').value.trim();
  if (!studentId || !name) {
    alert('학번과 이름을 모두 입력해주세요.');
    return;
  }

  const recordRef = await db.collection('umbrella_records').add({
    umbrellaNumber: currentUmbrellaNumber,
    renterName: name,
    studentId: studentId,
    rentDate: firebase.firestore.FieldValue.serverTimestamp(),
    returnDate: null,
    returnPhotoUrl: null,
    manager: currentManager,
    status: '대여중'
  });

  await db.collection('umbrella_status').doc(String(currentUmbrellaNumber)).set({
    status: '대여중',
    renterName: name,
    studentId: studentId,
    rentDate: firebase.firestore.FieldValue.serverTimestamp(),
    recordId: recordRef.id
  });

  closeModal('rentModalBg');
  loadUmbrellaStatus();
}

// ===== 반납 모달 =====
function openReturnModal(number, data) {
  document.getElementById('returnModalTitle').textContent = `${number}번 우산 반납`;
  document.getElementById('returnInfo').textContent = `대여자: ${data.renterName} (${data.studentId})`;
  document.getElementById('returnPhoto').value = '';
  document.getElementById('photoPreview').classList.remove('show');
  selectedPhotoFile = null;
  document.getElementById('returnModalBg').classList.add('show');
}

document.getElementById('returnPhoto').addEventListener('change', function() {
  const file = this.files[0];
  if (!file) return;
  selectedPhotoFile = file;
  const preview = document.getElementById('photoPreview');
  preview.src = URL.createObjectURL(file);
  preview.classList.add('show');
});

async function submitReturn() {
  const number = currentUmbrellaNumber;
  const data = umbrellaData[number];
  if (!data) return;

  let photoUrl = null;
  if (selectedPhotoFile) {
    const filePath = `umbrella_returns/${number}_${Date.now()}.jpg`;
    const ref = storage.ref().child(filePath);
    await ref.put(selectedPhotoFile);
    photoUrl = await ref.getDownloadURL();
  }

  if (data.recordId) {
    await db.collection('umbrella_records').doc(data.recordId).update({
      returnDate: firebase.firestore.FieldValue.serverTimestamp(),
      returnPhotoUrl: photoUrl,
      status: '반납완료'
    });
  }

  await db.collection('umbrella_status').doc(String(number)).set({
    status: '가능'
  });

  closeModal('returnModalBg');
  loadUmbrellaStatus();
}

async function submitLost() {
  const number = currentUmbrellaNumber;
  const data = umbrellaData[number];
  if (!data) return;

  const confirmLost = confirm(`${number}번 우산을 분실 처리하시겠습니까?\n대여자에게 벌금 ${LOST_FINE.toLocaleString()}원이 안내됩니다.`);
  if (!confirmLost) return;

  if (data.recordId) {
    await db.collection('umbrella_records').doc(data.recordId).update({
      status: '분실',
      fine: LOST_FINE
    });
  }

  await db.collection('umbrella_status').doc(String(number)).set({
    status: '분실',
    renterName: data.renterName,
    studentId: data.studentId
  });

  closeModal('returnModalBg');
  loadUmbrellaStatus();
  alert(`분실 처리 완료. ${data.renterName}님께 벌금 ${LOST_FINE.toLocaleString()}원 안내가 필요합니다.`);
}

function closeModal(id) {
  document.getElementById(id).classList.remove('show');
}

// ===== 실시간 상태 로드 =====
function loadUmbrellaStatus() {
  db.collection('umbrella_status').onSnapshot(snapshot => {
    umbrellaData = {};
    snapshot.forEach(doc => {
      umbrellaData[doc.id] = doc.data();
    });
    renderGrid();
  });
}

// 초기 렌더링 (데이터 없어도 전부 대여가능 상태로 표시)
renderGrid();
loadUmbrellaStatus();

// 3일 경과 표시가 실시간으로 갱신되도록 1분마다 다시 그리기
setInterval(renderGrid, 60000);

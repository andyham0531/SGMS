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

const OVERDUE_DAYS = 3;
const LOST_FINE = 5000;

function daysSince(timestamp) {
  if (!timestamp) return 0;
  const rentDate = timestamp.toDate ? timestamp.toDate() : new Date(timestamp);
  const diffMs = Date.now() - rentDate.getTime();
  return Math.floor(diffMs / (1000 * 60 * 60 * 24));
}

async function checkStatus() {
  const studentId = document.getElementById('studentIdInput').value.trim();
  const resultCard = document.getElementById('resultCard');
  const emptyMsg = document.getElementById('emptyMsg');

  resultCard.className = 'result-card';
  resultCard.innerHTML = '';
  emptyMsg.textContent = '';

  if (!studentId) {
    alert('학번을 입력해주세요.');
    return;
  }

  // 현재 대여중인 기록 조회 (가장 최근 대여 1건)
  const snapshot = await db.collection('umbrella_records')
    .where('studentId', '==', studentId)
    .where('status', '==', '대여중')
    .limit(1)
    .get();

  if (snapshot.empty) {
    emptyMsg.textContent = '현재 대여중인 우산이 없습니다.';
    return;
  }

  const data = snapshot.docs[0].data();
  const days = daysSince(data.rentDate);
  const isOverdue = days >= OVERDUE_DAYS;
  const rentDateStr = data.rentDate && data.rentDate.toDate
    ? data.rentDate.toDate().toLocaleDateString('ko-KR')
    : '-';

  resultCard.className = isOverdue ? 'result-card show overdue' : 'result-card show';
  resultCard.innerHTML = `
    <div class="row"><span class="label">우산 번호</span><span class="value">${data.umbrellaNumber}번</span></div>
    <div class="row"><span class="label">대여자</span><span class="value">${data.renterName}</span></div>
    <div class="row"><span class="label">대여일</span><span class="value">${rentDateStr}</span></div>
    <div class="row"><span class="label">경과일</span><span class="value">${days}일째</span></div>
    ${isOverdue ? `<div class="warning">⚠️ 반납일이 ${OVERDUE_DAYS}일 이상 지났습니다.<br>빠른 반납 부탁드립니다! (분실 시 벌금 ${LOST_FINE.toLocaleString()}원)</div>` : ''}
  `;
}

// 엔터키로도 조회 가능하게
document.getElementById('studentIdInput').addEventListener('keypress', function(e) {
  if (e.key === 'Enter') checkStatus();
});

import { db } from "./firebase.js";
import { studentsData } from "./students-data.js";

import {
collection,
doc,
addDoc,
setDoc,
updateDoc,
getDoc,
onSnapshot,
serverTimestamp
}
from "https://www.gstatic.com/firebasejs/11.9.1/firebase-firestore.js";

import {
getStorage,
ref,
uploadBytes,
getDownloadURL
}
from "https://www.gstatic.com/firebasejs/11.9.1/firebase-storage.js";

const storage = getStorage();

const TOTAL_UMBRELLAS = 15;
const OVERDUE_DAYS = 3;
const LOST_FINE = 5000;

const managerSelect=document.getElementById("managerSelect");

const umbrellaGrid=document.getElementById("umbrellaGrid");

const overdueList=document.getElementById("overdueList");

const rentModal=document.getElementById("rentModal");
const returnModal=document.getElementById("returnModal");

const rentTitle=document.getElementById("rentTitle");
const returnTitle=document.getElementById("returnTitle");

const studentIdInput=document.getElementById("studentId");
const studentNameInput=document.getElementById("studentName");

const rentBtn=document.getElementById("rentBtn");
const returnBtn=document.getElementById("returnBtn");
const lostBtn=document.getElementById("lostBtn");

const closeRent=document.getElementById("closeRent");
const closeReturn=document.getElementById("closeReturn");

const returnInfo=document.getElementById("returnInfo");
const returnPhoto=document.getElementById("returnPhoto");

let currentManager="";
let currentUmbrella=null;

let selectedPhoto=null;

let umbrellaData={};

const umbrellaCol=collection(db,"umbrellas");

const recordCol=collection(db,"umbrella_records");
managerSelect.addEventListener("change",()=>{

currentManager=managerSelect.value;

});
returnPhoto.addEventListener("change",(e)=>{

selectedPhoto=e.target.files[0]||null;

});
studentIdInput.addEventListener("input",()=>{

const id=studentIdInput.value.trim();

if(studentsData[id]){

studentNameInput.value=studentsData[id];

}

});
closeRent.addEventListener("click",()=>{

rentModal.classList.add("hidden");

});

closeReturn.addEventListener("click",()=>{

returnModal.classList.add("hidden");

});
function getPassedDays(time){

if(!time) return 0;

const date=time.toDate();

const diff=Date.now()-date.getTime();

return Math.floor(diff/86400000);

}
function getStatusClass(data){

if(!data||!data.status){

return "available";

}

if(data.status==="대여가능"){

return "available";

}

if(data.status==="분실"){

return "lost";

}

if(data.status==="대여중"){

  
const day=getPassedDays(data.rentDate);

if(day>=OVERDUE_DAYS){

return "overdue";

}

return "rented";

}

return "available";

}
// =======================
// 우산 상태 실시간 불러오기
// =======================

onSnapshot(umbrellaCol,(snapshot)=>{

umbrellaData={};

snapshot.forEach((docSnap)=>{

umbrellaData[docSnap.id]=docSnap.data();

});

renderGrid();

renderOverdue();

});

function renderGrid(){

umbrellaGrid.innerHTML="";

for(let i=1;i<=TOTAL_UMBRELLAS;i++){

const data=umbrellaData[i]||{

status:"대여가능"

};

const card=document.createElement("div");

card.className=`umbrellaCard ${getStatusClass(data)}`;

let text="대여가능";

if(data.status==="대여중"){

const day=getPassedDays(data.rentDate);

text=`${data.studentName}<br>${day}일`;

}

if(data.status==="분실"){

text="분실";

}

card.innerHTML=`

<div class="umbrellaNumber">

${i}번

</div>

<div class="umbrellaStatus">

${text}

</div>

`;

card.addEventListener("click",()=>{

openUmbrella(i,data);

});

umbrellaGrid.appendChild(card);

}

}

function openUmbrella(number,data){

if(currentManager===""){

alert("담당자를 먼저 선택해주세요.");

return;

}

currentUmbrella=number;

if(!data.status||data.status==="대여가능"){

openRent(number);

}else if(data.status==="대여중"){

openReturn(number,data);

}else{

alert("분실 처리된 우산입니다.");

}

}

function openRent(number){

rentTitle.textContent=`${number}번 우산 대여`;

studentIdInput.value="";

studentNameInput.value="";

rentModal.classList.remove("hidden");

}

function openReturn(number,data){

returnTitle.textContent=`${number}번 우산 반납`;

returnInfo.innerHTML=`

<b>${data.studentName}</b><br>

${data.studentId}

`;

selectedPhoto=null;

returnPhoto.value="";

returnModal.classList.remove("hidden");

}

function renderOverdue(){

overdueList.innerHTML="";

Object.entries(umbrellaData).forEach(([num,data])=>{

if(data.status!=="대여중") return;

const day=getPassedDays(data.rentDate);

if(day<OVERDUE_DAYS) return;

const div=document.createElement("div");

div.className="overdueItem";

div.innerHTML=`

${num}번

${data.studentName}

(${day}일)

`;

overdueList.appendChild(div);

});

}
// =======================
// 대여 처리
// =======================

async function submitRent(){

const studentId=studentIdInput.value.trim();
const studentName=studentNameInput.value.trim();

if(!studentId||!studentName){

alert("학번과 이름을 입력해주세요.");
return;

}

await setDoc(doc(db,"umbrella",String(currentUmbrella)),{

number:currentUmbrella,
status:"대여중",
studentId,
studentName,
manager:currentManager,
rentDate:new Date()

});

rentModal.classList.add("hidden");

}

// =======================
// 사진 선택
// =======================

let selectedPhoto=null;

returnPhoto.addEventListener("change",(e)=>{

selectedPhoto=e.target.files[0];

});

// =======================
// 반납 처리
// =======================

async function submitReturn(){

let photoUrl="";

if(selectedPhoto){

const photoRef=ref(

storage,

`umbrella/${currentUmbrella}_${Date.now()}.jpg`

);

await uploadBytes(photoRef,selectedPhoto);

photoUrl=await getDownloadURL(photoRef);

}

await setDoc(doc(db,"umbrella",String(currentUmbrella)),{

number:currentUmbrella,
status:"대여가능"

});

await addDoc(historyCol,{

umbrella:currentUmbrella,
studentName:umbrellaData[currentUmbrella].studentName,
studentId:umbrellaData[currentUmbrella].studentId,
manager:currentManager,
photo:photoUrl,
returnDate:new Date()

});

returnModal.classList.add("hidden");

}

// =======================
// 분실 처리
// =======================

async function submitLost(){

const ok=confirm(

`${currentUmbrella}번 우산을 분실 처리하시겠습니까?`

);

if(!ok)return;

await updateDoc(

doc(db,"umbrella",String(currentUmbrella)),

{

status:"분실"

}

);

alert("분실 처리되었습니다.");

returnModal.classList.add("hidden");

}

// =======================
// 모달 닫기
// =======================

function closeRent(){

rentModal.classList.add("hidden");

}

function closeReturn(){

returnModal.classList.add("hidden");

}

// =======================
// 날짜 계산
// =======================

function getPassedDays(date){

if(!date)return 0;

const rent=date.toDate?date.toDate():new Date(date);

const diff=Date.now()-rent.getTime();

return Math.floor(diff/1000/60/60/24);

}

// =======================
// 카드 색상
// =======================

function getStatusClass(data){

if(data.status==="대여중"){

const day=getPassedDays(data.rentDate);

if(day>=OVERDUE_DAYS)return "overdue";

return "rent";

}

if(data.status==="분실"){

return "lost";

}

return "available";

}
// =======================
// 학생 명렬표 자동완성
// =======================

studentIdInput.addEventListener("input",()=>{

const id=studentIdInput.value.trim();

if(studentsData[id]){

studentNameInput.value=studentsData[id];

}

});

// =======================
// 담당자 선택
// =======================

managerButtons.forEach(btn=>{

btn.addEventListener("click",()=>{

managerButtons.forEach(b=>b.classList.remove("active"));

btn.classList.add("active");

currentManager=btn.dataset.name;

});

});

// =======================
// 모달 바깥 클릭 시 닫기
// =======================

rentModal.addEventListener("click",(e)=>{

if(e.target===rentModal){

closeRent();

}

});

returnModal.addEventListener("click",(e)=>{

if(e.target===returnModal){

closeReturn();

}

});

// =======================
// 알림 보내기
// =======================

function sendReminder(number,data){

const day=getPassedDays(data.rentDate);

const text=

`[다원 우산대여]

${data.studentName}님

${number}번 우산이

${day}일째 미반납 상태입니다.

빠른 반납 부탁드립니다.`;

if(navigator.share){

navigator.share({

text

});

}else{

navigator.clipboard.writeText(text);

alert("알림 문구가 복사되었습니다.");

}

}

// =======================
// 1분마다 경과일 갱신
// =======================

setInterval(()=>{

renderGrid();

renderOverdue();

},60000);

console.log("Umbrella Admin Ready");

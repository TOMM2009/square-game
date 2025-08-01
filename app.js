let tempSignupEmail = "";

const firebaseConfig = {
  apiKey: "AIzaSyAZXpK17unJu2uA_QaWr9F2aXTcqK6M6RI",
  authDomain: "square-game-t2009.firebaseapp.com",
  projectId: "square-game-t2009",
  storageBucket: "square-game-t2009.appspot.com",
  messagingSenderId: "1058243373328",
  appId: "1:1058243373328:web:34abb2f10298317bdfdd95",
  measurementId: "G-7J1L8TSLB8"
};

firebase.initializeApp(firebaseConfig);
const auth = firebase.auth();
const db = firebase.firestore();

let excluded = [11, 13, 20, 30];
let questionCount = 0;
let totalQuestions = 20;
let records = [];
let currentQuestion = null;
let startTime = null;
let currentUser = null;

let timerInterval = null;
let timerStartTime = null;
window.onload = function () {
  auth.onAuthStateChanged(user => {
    if (user) {
      const saved = localStorage.getItem("squareGameState");

      if (saved) {
        const state = JSON.parse(saved);

        if (state.status === "end") {
          // 이미 끝난 게임 화면 보여주기
          currentUser = user;
          records = state.records || [];

          document.getElementById("loginForm").style.display = "none";
          document.getElementById("signupForm").style.display = "none";
          document.getElementById("game").style.display = "none";
          document.getElementById("logoutBtn").style.display = "block";

          // 복원해서 endGame 화면 구성
          showEndGame(state.records, state.avgTime);
        } else {
          // 게임 진행 중이던 상태 복원
          currentUser = user;
          questionCount = state.questionCount;
          currentQuestion = state.currentQuestion;
          records = state.records || [];
          startTime = state.startTime;

          const savedAt = state.timestampSaved || Date.now();
          const now = Date.now();
          const elapsedSinceSave = (now - savedAt) / 1000;

          if (elapsedSinceSave > 99.99) {
            handleTimeout();
          } else {
            startTimer(elapsedSinceSave);
          }

          document.getElementById("loginForm").style.display = "none";
          document.getElementById("signupForm").style.display = "none";
          document.getElementById("game").style.display = "block";
          document.getElementById("logoutBtn").style.display = "block";

          document.getElementById("welcome").textContent =
            `더원매쓰의 용사, ${state.user?.name || "용사"}님 파이팅!!!`;

          document.getElementById("welcome").dataset.username =
            state.user?.name || "용사";

          const num = (questionCount + 1).toString().padStart(2, "0");
          document.getElementById("questionNumberText").textContent =
            `[${num}번 문제]`;

          document.getElementById("questionText").textContent =
            currentQuestion.text;

          document.getElementById("answerInput").value = '';
          document.getElementById("feedback").textContent = '';

          adjustFontSize('.question-text');
        }
      } else {
        startGame(user, user.email);
      }
    } else {
      showLoginForm();
    }

    document.body.style.visibility = "visible";
  });
};


function showLoginForm() {
  document.getElementById("loginForm").style.display = "block";
  document.getElementById("signupForm").style.display = "none";
  document.getElementById("game").style.display = "none";
  document.getElementById("logoutBtn").style.display = "none";
  document.getElementById("result").innerHTML = "";
}

function login() {
  const email = document.getElementById("loginEmail").value;
  const password = document.getElementById("loginPassword").value;

  auth.signInWithEmailAndPassword(email, password)
    .then(userCredential => {
      const user = userCredential.user;
      const userRef = db.collection("users").doc(user.uid);

      return userRef.update({
        loginCount: firebase.firestore.FieldValue.increment(1)
      }).then(() => {
        return userRef.get();
      }).then(doc => {
        const data = doc.data();
        if (data.role === "admin") {
          showAdminPage(user);
        } else {
          startGame(user, data.name);
        }
      });
    })
    .catch(error => {
      document.getElementById("loginMsg").textContent = error.message;
    });
}

function resetPassword() {
  const email = document.getElementById("loginEmail").value;

  if (!email) {
    document.getElementById("loginMsg").textContent = "이메일을 입력해 주세요.";
    return;
  }

  auth.sendPasswordResetEmail(email)
    .then(() => {
      document.getElementById("loginMsg").textContent =
        "비밀번호 재설정 이메일을 보냈습니다. 메일함을 확인해 주세요!";
    })
    .catch(error => {
      document.getElementById("loginMsg").textContent = error.message;
    });
}

function signup() {
  const email = document.getElementById("signupEmail").value;
  const password = document.getElementById("signupPassword").value;
  const name = document.getElementById("signupName").value;
  const grade = document.getElementById("signupGrade").value;

  if (!name || !grade) {
    document.getElementById("signupMsg").textContent = "이름과 학년을 입력해주세요.";
    return;
  }

  if (name.length > 7) {
    document.getElementById("signupMsg").textContent = "이름은 최대 7자까지 입력할 수 있습니다.";
    return;
  }

  auth.createUserWithEmailAndPassword(email, password)
    .then(userCredential => {
      const user = userCredential.user;
      return db.collection("users").doc(user.uid).set({
        uid: user.uid,
        email: email,
        name: name,
        grade: grade,
        loginCount: 0,
        bestTime: null,
        avgTime: null,
        recentTimes: [],
        top10Slow: [],
        top10Fast: [],
        role: email === "tsquare75@gmail.com" ? "admin" : "user"
      });
    })
    .then(() => {
      tempSignupEmail = email;
      auth.signOut().then(() => {
        document.getElementById("signupMsg").textContent =
          "회원가입 성공! 로그인 해주세요.";
        showLogin();
      });
    })
    .catch(error => {
      document.getElementById("signupMsg").textContent = error.message;
    });
}

function showSignup() {
  document.getElementById("loginForm").style.display = "none";
  document.getElementById("signupForm").style.display = "block";
}

function showLogin() {
  document.getElementById("signupForm").style.display = "none";
  document.getElementById("loginForm").style.display = "block";

  if (tempSignupEmail) {
    document.getElementById("loginEmail").value = tempSignupEmail;
    tempSignupEmail = "";
  }
}

function showAdminPage(user) {
  document.getElementById("loginForm").style.display = "none";
  document.getElementById("signupForm").style.display = "none";
  document.getElementById("game").style.display = "none";
  document.getElementById("result").innerHTML = "";

  document.getElementById("logoutBtn").style.display = "block";
  document.getElementById("adminPage").style.display = "block";

  let html = `<h2>🔑 관리자 페이지</h2>`;
  html += `<p>${user.email} 계정으로 접속했습니다.</p>`;

  html += `
    <table border="1" cellspacing="0" cellpadding="5">
      <tr>
        <th>이름</th>
        <th>이메일</th>
        <th>학년</th>
        <th>로그인 횟수</th>
      </tr>`;

  db.collection("users").get()
    .then(snapshot => {
      snapshot.forEach(doc => {
        const data = doc.data();
        html += `
          <tr style="cursor:pointer;" onclick="viewUserDetail('${doc.id}')">
            <td>${data.name || ""}</td>
            <td>${data.email || ""}</td>
            <td>${data.grade || ""}</td>
            <td>${data.loginCount || 0}</td>
          </tr>`;
      });

      html += `</table>`;
      document.getElementById("adminPage").innerHTML = html;
    })
    .catch(error => {
      document.getElementById("adminPage").innerHTML =
        `<p>에러 발생: ${error.message}</p>`;
    });
}

function logout() {
  localStorage.removeItem("squareGameState");
  auth.signOut().then(() => {
    document.getElementById("adminPage").innerHTML = "";
    document.getElementById("adminPage").style.display = "none";
    showLoginForm();
  });
}

function startGame(user, userName) {
  currentUser = user;

  userName = userName || "용사";

  document.getElementById("welcome").dataset.username = userName;

  document.getElementById("loginForm").style.display = "none";
  document.getElementById("signupForm").style.display = "none";
  document.getElementById("game").style.display = "block";
  document.getElementById("logoutBtn").style.display = "block";

  document.getElementById("welcome").textContent =
    `더원매쓰의 용사, ${userName}님 파이팅!!!`;

  gameInit();
  document.getElementById("answerInput").focus();
}

function gameInit() {
  questionCount = 0;
  records = [];
  nextQuestion();
}

function nextQuestion() {
  
  document.getElementById("nextBtn").style.display = "none";
  document.getElementById("game").classList.remove("wrong-background");
  document.getElementById("game").classList.remove("correct-background");
  
  if (questionCount >= totalQuestions) {
    endGame();
    return;
  }

  let num;
  do {
    num = Math.floor(Math.random() * (32 - 11 + 1)) + 11;
  } while (excluded.includes(num));

  const direction = Math.random() < 0.5 ? 'forward' : 'reverse';

  if (direction === 'forward') {
    const square = num * num;
    currentQuestion = {
      text: `?² = ${square}`,
      answer: num
    };
  } else {
    currentQuestion = {
      text: `${num}² = ?`,
      answer: num * num
    };
  }

  const numText = String(questionCount + 1).padStart(2, "0");
  document.getElementById("questionNumberText").textContent =
    `[${numText}번 문제]`;

  document.getElementById("questionText").textContent =
    currentQuestion.text;

  document.getElementById("answerInput").value = '';
  document.getElementById("feedback").textContent = '';

  startTime = performance.now();

  adjustFontSize('.question-text');

  startTimer(0);
  document.getElementById("answerInput").focus();
  
  localStorage.setItem("squareGameState", JSON.stringify({
    questionCount,
    currentQuestion,
    records,
    startTime,
    user: {
      uid: currentUser?.uid,
      email: currentUser?.email,
      name: document.getElementById("welcome").dataset.username || ""
    },
    timestampSaved: Date.now()
  }));
}


function startTimer(savedElapsedTime = 0) {
  const MAX_SECONDS = 99.99;
  const savedMs = savedElapsedTime * 1000;

  timerStartTime = performance.now() - savedMs;
  clearInterval(timerInterval);

  timerInterval = setInterval(() => {
    const now = performance.now();
    let elapsed = (now - timerStartTime) / 1000;

    // 99.99 초로 잘라버리기
    elapsed = Math.min(elapsed, MAX_SECONDS);

    const seconds = Math.floor(elapsed);
    const centiseconds = Math.floor((elapsed * 100) % 100);

    const formatted =
      String(seconds).padStart(2, "0") + ":" +
      String(centiseconds).padStart(2, "0");

    document.getElementById("timer").textContent = formatted;

    if (elapsed >= MAX_SECONDS) {
      clearInterval(timerInterval);
      handleTimeout();
      return;
    }
  }, 10);
}



function stopTimer() {
  clearInterval(timerInterval);
 // document.getElementById("timer").textContent = "";
}

function handleTimeout() {
  localStorage.removeItem("squareGameState");
  document.getElementById("feedback").textContent =
    `시간 초과! 정답은 ${currentQuestion.answer} 입니다.`;

  // 회색 배경 효과 추가
  document.getElementById("game").classList.add("timeout-background");

  setTimeout(() => {
    document.getElementById("game").classList.remove("timeout-background");
  }, 1000);

  questionCount++;
  setTimeout(nextQuestion, 1000);
}

function submitAnswer() {
  const inputElem = document.getElementById("answerInput");
  const input = inputElem.value.trim();

  // ➡️ 빈칸일 때
  if (input === "") {
    document.getElementById("feedback").textContent = "답을 입력하세요!";
    return;
  }

  // ➡️ 숫자가 아닐 때
  if (isNaN(input)) {
    inputElem.value = "";
    document.getElementById("feedback").textContent = "수를 입력하세요!";
    return;
  }

  // ➡️ 정상 입력일 때만 stopTimer()
  stopTimer();

  const userAnswer = Number(input);
  const endTime = performance.now();
  const timeTaken = ((endTime - startTime) / 1000).toFixed(2);

  if (userAnswer === currentQuestion.answer) {
    // 정답일 때 배경 변경
    document.getElementById("game").classList.add("correct-background");

    // 잠깐 보여주고 다음 문제로
    setTimeout(() => {
      document.getElementById("game").classList.remove("correct-background");
      nextQuestion();
    }, 1000);

    // 기록 저장
    records.push({
      question: currentQuestion.text,
      time: parseFloat(timeTaken)
    });
  } else {
    // 오답일 때 정답 출력 + 배경 변경 + 다음 버튼 표시
    document.getElementById("feedback").innerHTML =
      `오답! 정답은 <span class="correct-answer">${currentQuestion.answer}</span> 입니다.`;

    document.getElementById("game").classList.add("wrong-background");
    document.getElementById("nextBtn").style.display = "inline-block";
    document.getElementById("nextBtn").focus();
  }

  questionCount++;
}

function calculateAverageTime() {
  if (records.length === 0) return "0.00";

  const totalTime = records.reduce((sum, rec) => sum + rec.time, 0);
  return (totalTime / records.length).toFixed(2);
}

function endGame() {
  stopTimer();
  const correctCount = records.length;

  // 평균 응답 시간 계산
  let avgTime = "-";
  if (correctCount > 0) {
    const totalTime = records.reduce((acc, cur) => acc + cur.time, 0);
    avgTime = (totalTime / correctCount).toFixed(2);
  }

  records.sort((a, b) => b.time - a.time);
  const topRecords = records.slice(0, 10);

  let tableBody = "";

  if (topRecords.length === 0) {
    tableBody = `
      <tr>
        <td colspan="3">기록 없음</td>
      </tr>
    `;
  } else {
    topRecords.forEach((rec, idx) => {
      tableBody += `
        <tr>
          <td>${idx + 1}</td>
          <td>${rec.question}</td>
          <td>${rec.time.toFixed(2)}</td>
        </tr>
      `;
    });
  }

  let html = `
    <h2 class="result-title">
      게임 종료!
    </h2>
    <div class="result-subtitle">
      ${totalQuestions}문제 중 <span class="correct-count">${correctCount}</span>문제 정답!
    </div>
    <div class="result-subtitle">
      평균 응답 시간: ${avgTime}초
    </div>
    <h2 class="result-title">
      느린 문제 Top 10
    </h2>
    <div class="result-table-wrapper">
      <table class="result-table">
        <thead>
          <tr>
            <th>No</th>
            <th>문제</th>
            <th>시간(초)</th>
          </tr>
        </thead>
        <tbody>
          ${tableBody}
        </tbody>
      </table>
    </div>
    <div style="margin-top: 20px; text-align: center;">
      <button onclick="restartGame()"
        style="padding: 10px 20px; font-size: 16px; background-color: #28a745; color: white; border: none; border-radius: 5px; cursor: pointer;">
        한판더!!
      </button>
    </div>
  `;

  document.getElementById("game").style.display = "none";
  document.getElementById("result").innerHTML = html;

  localStorage.setItem("squareGameState", JSON.stringify({
    status: "end",
    records,
    avgTime,
    user: {
      uid: currentUser?.uid,
      email: currentUser?.email,
      name: document.getElementById("welcome").dataset.username || ""
    },
    timestampSaved: Date.now()
  }));
}





function showEndGame(savedRecords, savedAvgTime) {
  records = savedRecords || [];
  const correctCount = records.length;
  const avgTime = savedAvgTime !== undefined ? savedAvgTime : "-";

  records.sort((a, b) => b.time - a.time);
  const topRecords = records.slice(0, 10);

  let tableBody = "";

  if (topRecords.length === 0) {
    tableBody = `
      <tr>
        <td colspan="3">기록 없음</td>
      </tr>
    `;
  } else {
    topRecords.forEach((rec, idx) => {
      tableBody += `
        <tr>
          <td>${idx + 1}</td>
          <td>${rec.question}</td>
          <td>${rec.time.toFixed(2)}</td>
        </tr>
      `;
    });
  }

  let html = `
    <h2 class="result-title">
      게임 종료!
    </h2>
    <div class="result-subtitle">
      ${totalQuestions}문제 중 <span class="correct-count">${correctCount}</span>문제 정답!
    </div>
    <div class="result-subtitle">
      평균 응답 시간: ${avgTime}초
    </div>
    <h2 class="result-title">
      느린 문제 Top 10
    </h2>
    <div class="result-table-wrapper">
      <table class="result-table">
        <thead>
          <tr>
            <th>No</th>
            <th>문제</th>
            <th>시간(초)</th>
          </tr>
        </thead>
        <tbody>
          ${tableBody}
        </tbody>
      </table>
    </div>
    <div style="margin-top: 20px; text-align: center;">
      <button onclick="restartGame()"
        style="padding: 10px 20px; font-size: 16px; background-color: #28a745; color: white; border: none; border-radius: 5px; cursor: pointer;">
        한판더!!
      </button>
    </div>
  `;

  document.getElementById("result").innerHTML = html;
}





function restartGame() {
  document.getElementById("result").innerHTML = "";

  let userName = "용사";

  const saved = localStorage.getItem("squareGameState");
  if (saved) {
    const state = JSON.parse(saved);
    userName = state.user?.name || userName;
  } else {
    userName =
      document.getElementById("welcome").dataset.username ||
      currentUser?.email?.split("@")[0] ||
      "용사";
  }

  startGame(currentUser, userName);
}



function viewUserDetail(uid) {
  db.collection("users").doc(uid).get()
    .then(doc => {
      if (!doc.exists) {
        document.getElementById("adminPage").innerHTML =
          "<p>해당 유저 정보를 찾을 수 없습니다.</p>";
        return;
      }

      const data = doc.data();
      let html = `<div class="admin-detail">`;

      html += `<h2>유저 상세 정보</h2>`;
      html += `<p><strong>이름:</strong> ${data.name || ""}</p>`;
      html += `<p><strong>이메일:</strong> ${data.email || ""}</p>`;
      html += `<p><strong>학년:</strong> ${data.grade || ""}</p>`;
      html += `<p><strong>로그인 횟수:</strong> ${data.loginCount || 0}</p>`;
      html += `<p><strong>bestTime:</strong> ${data.bestTime !== null ? data.bestTime + "초" : "-"}</p>`;
      html += `<p><strong>avgTime:</strong> ${data.avgTime !== null ? data.avgTime + "초" : "-"}</p>`;

      html += `<h3>최근 문제 기록</h3>`;
      if (data.recentTimes && data.recentTimes.length > 0) {
        html += `<ul>`;
        data.recentTimes.forEach(time => {
          html += `<li>${time}초</li>`;
        });
        html += `</ul>`;
      } else {
        html += `<p>기록 없음</p>`;
      }

      html += `<h3>Top 10 빠른 기록</h3>`;
      if (data.top10Fast && data.top10Fast.length > 0) {
        html += `<ul>`;
        data.top10Fast.forEach(time => {
          html += `<li>${time}초</li>`;
        });
        html += `</ul>`;
      } else {
        html += `<p>기록 없음</p>`;
      }

      html += `<h3>Top 10 느린 기록</h3>`;
      if (data.top10Slow && data.top10Slow.length > 0) {
        html += `<ul>`;
        data.top10Slow.forEach(time => {
          html += `<li>${time}초</li>`;
        });
        html += `</ul>`;
      } else {
        html += `<p>기록 없음</p>`;
      }

      html += `<button onclick="showAdminPage(currentUser)">← 돌아가기</button>`;
      html += `</div>`;

      document.getElementById("adminPage").innerHTML = html;
    })
    .catch(error => {
      document.getElementById("adminPage").innerHTML =
        `<p>에러 발생: ${error.message}</p>`;
    });
}
function adjustFontSize(selector, maxSize = 64, minSize = 20, step = 2) {
  const elem = document.querySelector(selector);
  if (!elem) return;

  const parentWidth = elem.parentElement.clientWidth;
  let fontSize = maxSize;

  elem.style.fontSize = fontSize + 'px';
  elem.style.whiteSpace = 'nowrap';

  while (elem.scrollWidth > parentWidth && fontSize > minSize) {
    fontSize -= step;
    elem.style.fontSize = fontSize + 'px';
  }
}

document.getElementById("answerInput").addEventListener("keydown", function (event) {
  if (event.key === "Enter") {
    event.preventDefault();
    submitAnswer();
  }
});
document.getElementById("loginPassword").addEventListener("keydown", function (event) {
  if (event.key === "Enter") {
    event.preventDefault();
    login();
  }
});
document.getElementById("loginEmail").addEventListener("keydown", function (event) {
  if (event.key === "Enter") {
    event.preventDefault();
    document.getElementById("loginPassword").focus();
  }
});

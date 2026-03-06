// ─── STATE ───────────────────────────────────────────────────────────────────
const MODES = {
  focus: { label: 'Focus Time', duration: 25 * 60, color: '#0db8c4' },
  short: { label: 'Short Break', duration: 5 * 60, color: '#2ec4a0' },
  long:  { label: 'Long Break',  duration: 15 * 60, color: '#38e8d0' },
};

let currentMode = 'focus';
let time = MODES.focus.duration;
let total = MODES.focus.duration;
let timerInterval = null;
let running = false;
let sessions = 0;
let totalMinutes = 0;
let streak = 0;
let sessionHistory = Array(7).fill(0); // last 7 session slots

// ─── DOM REFS ─────────────────────────────────────────────────────────────────
const progressRing = document.getElementById('progress');
const timeDisplay = document.getElementById('time');
const modeLabelEl = document.getElementById('modeLabel');
const startPauseBtn = document.getElementById('startPauseBtn');
const statusDot = document.getElementById('statusDot');
const statusText = document.getElementById('statusText');
const alarm = document.getElementById('alarm');

const CIRCUMFERENCE = 2 * Math.PI * 95; // r=95

// ─── TIMER CORE ──────────────────────────────────────────────────────────────
function updateDisplay() {
  const m = Math.floor(time / 60);
  const s = time % 60;
  timeDisplay.textContent = `${m}:${s < 10 ? '0' : ''}${s}`;
  document.title = `${m}:${s < 10 ? '0' : ''}${s} · Pomodoro Pro`;

  const pct = time / total;
  progressRing.style.strokeDashoffset = CIRCUMFERENCE - CIRCUMFERENCE * pct;
}

function toggleTimer() {
  if (running) {
    pauseTimer();
  } else {
    startTimer();
  }
}

function startTimer() {
  running = true;
  startPauseBtn.textContent = 'Pause';
  statusDot.classList.add('active');
  statusText.textContent = `${MODES[currentMode].label} in progress…`;

  timerInterval = setInterval(() => {
    time--;
    updateDisplay();
    if (time <= 0) {
      clearInterval(timerInterval);
      running = false;
      onSessionComplete();
    }
  }, 1000);
}

function pauseTimer() {
  clearInterval(timerInterval);
  running = false;
  startPauseBtn.textContent = 'Resume';
  statusDot.classList.remove('active');
  statusText.textContent = 'Paused';
}

function resetTimer() {
  clearInterval(timerInterval);
  running = false;
  time = total;
  startPauseBtn.textContent = 'Start';
  statusDot.classList.remove('active');
  statusText.textContent = 'Ready to focus';
  updateDisplay();
}

function skipSession() {
  clearInterval(timerInterval);
  running = false;
  time = 0;
  onSessionComplete();
}

function onSessionComplete() {
  startPauseBtn.textContent = 'Start';
  statusDot.classList.remove('active');

  if (currentMode === 'focus') {
    sessions++;
    totalMinutes += Math.round(MODES.focus.duration / 60);
    streak++;
    updateStats();
    sessionHistory.push(1);
    sessionHistory.shift();
    updateChart();
    showToast('🍅 Focus session complete! Take a break.');
    statusText.textContent = 'Session complete — great work!';
    alarm.play().catch(() => {});
  } else {
    showToast('☕ Break over — back to focus!');
    statusText.textContent = 'Break done — ready for more?';
  }
}

function setMode(mode, tabEl) {
  currentMode = mode;
  time = MODES[mode].duration;
  total = MODES[mode].duration;

  document.querySelectorAll('.mode-tab').forEach(t => t.classList.remove('active'));
  tabEl.classList.add('active');

  modeLabelEl.textContent = MODES[mode].label;
  progressRing.style.stroke = MODES[mode].color;

  clearInterval(timerInterval);
  running = false;
  startPauseBtn.textContent = 'Start';
  statusDot.classList.remove('active');
  statusText.textContent = 'Ready to focus';
  updateDisplay();
}

// ─── STATS ───────────────────────────────────────────────────────────────────
function updateStats() {
  document.getElementById('sessionCount').textContent = sessions;
  document.getElementById('completedStat').textContent = sessions;
  document.getElementById('minutesStat').textContent = totalMinutes;
  document.getElementById('streakStat').textContent = streak;
}

// ─── CHART ───────────────────────────────────────────────────────────────────
const ctx = document.getElementById('chart');
const chart = new Chart(ctx, {
  type: 'bar',
  data: {
    labels: ['', '', '', '', '', '', 'Now'],
    datasets: [{
      label: 'Sessions',
      data: [...sessionHistory],
      backgroundColor: 'rgba(13, 184, 196, 0.55)',
      borderColor: '#0db8c4',
      borderWidth: 1,
      borderRadius: 4,
    }]
  },
  options: {
    responsive: true,
    plugins: {
      legend: { display: false },
    },
    scales: {
      y: {
        beginAtZero: true,
        ticks: { stepSize: 1, color: '#6b6260', font: { family: 'DM Mono', size: 10 } },
        grid: { color: '#2e2a2a' },
      },
      x: {
        ticks: { color: '#6b6260', font: { family: 'DM Mono', size: 10 } },
        grid: { display: false },
      }
    }
  }
});

function updateChart() {
  chart.data.datasets[0].data = [...sessionHistory];
  chart.update();
}

// ─── TASKS ───────────────────────────────────────────────────────────────────
let tasks = loadTasksFromStorage();

function renderTasks() {
  const list = document.getElementById('taskList');
  const empty = document.getElementById('emptyState');

  // Clear existing task items (keep empty state)
  list.querySelectorAll('.task-item').forEach(el => el.remove());

  if (tasks.length === 0) {
    empty.style.display = 'block';
  } else {
    empty.style.display = 'none';
    tasks.forEach((task, i) => {
      const li = document.createElement('li');
      li.className = 'task-item' + (task.done ? ' done' : '');
      li.innerHTML = `
        <div class="task-checkbox"></div>
        <span class="task-text">${escapeHtml(task.text)}</span>
        <button class="task-delete" onclick="deleteTask(${i}, event)" title="Delete">✕</button>
      `;
      li.querySelector('.task-checkbox').addEventListener('click', () => toggleTask(i));
      li.querySelector('.task-text').addEventListener('click', () => toggleTask(i));
      list.appendChild(li);
    });
  }

  const total = tasks.length;
  const done = tasks.filter(t => t.done).length;
  document.getElementById('taskCount').textContent =
    total === 0 ? '0 tasks' : `${done}/${total} done`;
}

function addTask() {
  const input = document.getElementById('taskInput');
  const text = input.value.trim();
  if (!text) return;

  tasks.push({ text, done: false });
  input.value = '';
  saveTasksToStorage();
  renderTasks();
}

function toggleTask(index) {
  tasks[index].done = !tasks[index].done;
  if (tasks[index].done) streak = Math.max(streak, streak); // keep streak
  saveTasksToStorage();
  renderTasks();
}

function deleteTask(index, event) {
  event.stopPropagation();
  tasks.splice(index, 1);
  saveTasksToStorage();
  renderTasks();
}

function saveTasksToStorage() {
  try { localStorage.setItem('pp_tasks', JSON.stringify(tasks)); } catch(e) {}
}

function loadTasksFromStorage() {
  try { return JSON.parse(localStorage.getItem('pp_tasks')) || []; } catch(e) { return []; }
}

function escapeHtml(str) {
  return str.replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
}

// ─── TOAST ───────────────────────────────────────────────────────────────────
let toastTimeout;
function showToast(msg) {
  const t = document.getElementById('toast');
  t.textContent = msg;
  t.classList.add('show');
  clearTimeout(toastTimeout);
  toastTimeout = setTimeout(() => t.classList.remove('show'), 3500);
}

// ─── INIT ─────────────────────────────────────────────────────────────────────
updateDisplay();
renderTasks();

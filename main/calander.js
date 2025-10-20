// Enhanced calendar with per-day tasks, upcoming list, and persistent per-user storage

// Simple dictionary of users
const users = {
    'admin': 'admin123',
    'user1': 'pass1'
};

// Elements (available because script is defer)
const loginForm = document.getElementById('loginForm');
const loginError = document.getElementById('loginError');
const loginPage = document.getElementById('loginPage');
const calendarPage = document.getElementById('calendarPage');

const leftArrow = document.getElementById('left_arrow');
const rightArrow = document.getElementById('right_arrow');
const currentYearEl = document.getElementById('currentyear');
const daysDev = document.getElementById('daysdev');
const monthButtons = document.querySelectorAll('.monthbutton');

let currentUser = null;
let userData = { tasks: {} }; // tasks: { 'YYYY-MM': { '1': [ {id, text, completed, createdAt} ] } }

let currentYear = new Date().getFullYear();
let currentMonth = new Date().getMonth(); // 0-11

const monthNames = [
    'January', 'February', 'March', 'April', 'May', 'June',
    'July', 'August', 'September', 'October', 'November', 'December'
];
const daysnames = [
    'Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'
];

/* -------------------- Persistence helpers -------------------- */
function storageKeyFor(username) {
    return `calendarData_${username}`;
}
function loadUserData(username) {
    try {
        const raw = localStorage.getItem(storageKeyFor(username));
        if (!raw) return { tasks: {} };
        const parsed = JSON.parse(raw);
        if (!parsed || typeof parsed !== 'object') return { tasks: {} };
        if (!parsed.tasks) parsed.tasks = {};
        return parsed;
    } catch (e) {
        console.error('Failed parsing user data; starting fresh', e);
        return { tasks: {} };
    }
}
function saveUserData() {
    if (!currentUser) return;
    try {
        localStorage.setItem(storageKeyFor(currentUser), JSON.stringify(userData));
    } catch (e) {
        console.error('Failed saving user data', e);
    }
}
function getMonthKey(year, monthIndex) {
    return `${year}-${String(monthIndex + 1).padStart(2, '0')}`;
}
function ensureDayArray(year, monthIndex, day) {
    const mk = getMonthKey(year, monthIndex);
    if (!userData.tasks[mk]) userData.tasks[mk] = {};
    if (!userData.tasks[mk][day]) userData.tasks[mk][day] = [];
    return userData.tasks[mk][day];
}

/* -------------------- UI helpers -------------------- */
function startOfDay(d) {
    const x = new Date(d);
    x.setHours(0, 0, 0, 0);
    return x;
}
function today() { return startOfDay(new Date()); }

function injectEnhancedStyles() {
    if (document.getElementById('calendar-enhanced-styles')) return;
    const style = document.createElement('style');
    style.id = 'calendar-enhanced-styles';
    style.textContent = `
    :root {
        --ink: #0b0b0b;
        --accent: #3b82f6;       /* blue */
        --accent-2: #22c55e;     /* green */
        --accent-3: #f97316;     /* orange */
        --muted: #eef2ff;        /* light indigo */
        --muted-2: #e6fffa;      /* light teal */
        --muted-3: #fff7ed;      /* light orange */
        --danger: #ef4444;       /* red */
        --gray-700: #404040;
        --gray-500: #737373;
    }
    
    /* Header colors */
    #currentyear { background: var(--muted); }
    #left_arrow, #right_arrow { background: var(--ink); color: #fff; }

    /* Day cell internals */
    .day { position: relative; background: #fff; }
    .day.today { background: var(--muted-2); }
    .day-header {
        display: inline-block;
        min-width: 34px;
        padding: 4px 10px;
        border: 3px solid var(--ink);
        border-radius: 999px;
        font-weight: 800;
        background: #fff;
        margin-bottom: 6px;
    }
    .task-list { list-style: none; padding: 0; margin: 6px 0 0; display: flex; flex-direction: column; gap: 6px; }
    .task-item { display: flex; align-items: center; gap: 8px; border: 2px solid var(--ink); border-radius: 999px; padding: 4px 8px; background: #fff; }
    .task-item.completed { opacity: 0.6; text-decoration: line-through; }
    .task-text { flex: 1; font-size: 13px; }
    .task-actions { display: inline-flex; gap: 6px; align-items: center; }
    .task-btn { border: 2px solid var(--ink); border-radius: 999px; padding: 2px 6px; cursor: pointer; background: var(--muted-3); font-weight: 700; }
    .task-btn.delete { background: #fff; color: var(--danger); }

    .task-input-row { display: flex; gap: 6px; margin-top: 8px; }
    .task-input { flex: 1; border: 3px solid var(--ink); border-radius: 999px; padding: 6px 10px; }
    .task-add { border: 3px solid var(--ink); border-radius: 999px; padding: 6px 12px; background: var(--accent-2); color: #fff; font-weight: 800; cursor: pointer; }

    #tododev h3 { background: var(--muted); }
    #todolist li { background: var(--muted-3); }

    #toolsbar { display: flex; gap: 8px; margin-top: 8px; justify-content: center; }
    #toolsbar button { border: 3px solid var(--ink); border-radius: 999px; padding: 6px 12px; background: #fff; cursor: pointer; font-weight: 700; }
    `;
    document.head.appendChild(style);
}

/* -------------------- Rendering -------------------- */
function renderCalendar(month = currentMonth, year = currentYear) {
    daysDev.innerHTML = '';
    const firstDay = new Date(year, month, 1).getDay();
    const daysInMonth = new Date(year, month + 1, 0).getDate();

    // Day name headers
    for (let i = 0; i < 7; i++) {
        const dayNameEl = document.createElement('div');
        dayNameEl.classList.add('day-name');
        dayNameEl.textContent = daysnames[i].substring(0, 3);
        daysDev.appendChild(dayNameEl);
    }

    // Blanks before first day
    for (let i = 0; i < firstDay; i++) {
        const blankDay = document.createElement('div');
        blankDay.classList.add('day');
        blankDay.textContent = '';
        blankDay.style.visibility = 'hidden';
        daysDev.appendChild(blankDay);
    }

    // Actual days
    for (let dayNum = 1; dayNum <= daysInMonth; dayNum++) {
        const dayEl = document.createElement('div');
        dayEl.classList.add('day');

        const todayDate = new Date();
        if (todayDate.getFullYear() === year && todayDate.getMonth() === month && todayDate.getDate() === dayNum) {
            dayEl.classList.add('today');
        }

        // Header with day number
        const header = document.createElement('div');
        header.className = 'day-header';
        header.textContent = String(dayNum);
        dayEl.appendChild(header);

        // Task list
        const list = document.createElement('ul');
        list.className = 'task-list';
        dayEl.appendChild(list);

        // Render existing tasks
        renderTasksForDay(list, dayNum, month, year);

        // Add row
        const inputRow = document.createElement('div');
        inputRow.className = 'task-input-row';
        const input = document.createElement('input');
        input.className = 'task-input';
        input.type = 'text';
        input.placeholder = 'Add task…';
        const addBtn = document.createElement('button');
        addBtn.className = 'task-add';
        addBtn.textContent = '+';

        addBtn.addEventListener('click', () => {
            const val = input.value.trim();
            if (!val) return;
            addTask(year, month, dayNum, val);
            input.value = '';
            // Re-render day and upcoming list
            renderTasksForDay(list, dayNum, month, year);
            renderUpcomingTasks();
        });
        input.addEventListener('keydown', (e) => {
            if (e.key === 'Enter') {
                addBtn.click();
            }
        });

        inputRow.appendChild(input);
        inputRow.appendChild(addBtn);
        dayEl.appendChild(inputRow);

        daysDev.appendChild(dayEl);
    }
    currentYearEl.textContent = year;
}

function renderTasksForDay(listEl, dayNum, month, year) {
    listEl.innerHTML = '';
    const mk = getMonthKey(year, month);
    const tasks = (userData.tasks[mk] && userData.tasks[mk][dayNum]) ? userData.tasks[mk][dayNum] : [];
    tasks.forEach(task => {
        const li = document.createElement('li');
        li.className = 'task-item' + (task.completed ? ' completed' : '');
        li.dataset.taskId = task.id;
        li.dataset.day = String(dayNum);
        li.dataset.month = String(month);
        li.dataset.year = String(year);

        const cb = document.createElement('input');
        cb.type = 'checkbox';
        cb.checked = !!task.completed;
        cb.addEventListener('change', () => {
            toggleTask(year, month, dayNum, task.id, cb.checked);
            li.classList.toggle('completed', cb.checked);
            renderUpcomingTasks();
        });

        const text = document.createElement('span');
        text.className = 'task-text';
        text.textContent = task.text;

        const actions = document.createElement('span');
        actions.className = 'task-actions';
        const del = document.createElement('button');
        del.className = 'task-btn delete';
        del.title = 'Delete task';
        del.textContent = '×';
        del.addEventListener('click', () => {
            deleteTask(year, month, dayNum, task.id);
            renderTasksForDay(listEl, dayNum, month, year);
            renderUpcomingTasks();
        });

        actions.appendChild(del);
        li.appendChild(cb);
        li.appendChild(text);
        li.appendChild(actions);
        listEl.appendChild(li);
    });
}

function renderUpcomingTasks() {
    const list = document.getElementById('todolist');
    if (!list) return;
    list.innerHTML = '';
    const upcoming = collectUpcomingTasks(7); // next 7 days

    if (upcoming.length === 0) {
        const li = document.createElement('li');
        li.textContent = 'No upcoming tasks in the next 7 days.';
        list.appendChild(li);
        return;
    }

    upcoming.forEach(item => {
        const li = document.createElement('li');
        li.className = 'task-item';
        const dateStr = `${monthNames[item.date.getMonth()].slice(0,3)} ${String(item.date.getDate()).padStart(2,'0')}`;

        const cb = document.createElement('input');
        cb.type = 'checkbox';
        cb.checked = !!item.completed;
        cb.addEventListener('change', () => {
            toggleTask(item.year, item.monthIndex, item.day, item.id, cb.checked);
            renderCalendar(currentMonth, currentYear); // keep UI in sync
            renderUpcomingTasks();
        });

        const text = document.createElement('span');
        text.className = 'task-text';
        text.textContent = `[${dateStr}] ${item.text}`;

        li.appendChild(cb);
        li.appendChild(text);
        list.appendChild(li);
    });
}

function collectUpcomingTasks(windowDays = 7) {
    const now = today();
    const end = startOfDay(new Date(now.getFullYear(), now.getMonth(), now.getDate() + windowDays));
    const results = [];
    for (const mk of Object.keys(userData.tasks || {})) {
        const [yStr, mStr] = mk.split('-');
        const y = parseInt(yStr, 10);
        const mIndex = parseInt(mStr, 10) - 1; // 0-11
        const daysObj = userData.tasks[mk];
        for (const dStr of Object.keys(daysObj)) {
            const d = parseInt(dStr, 10);
            const dt = startOfDay(new Date(y, mIndex, d));
            if (dt >= now && dt <= end) {
                for (const t of daysObj[dStr]) {
                    if (!t.completed) {
                        results.push({ id: t.id, text: t.text, completed: t.completed, date: dt, year: y, monthIndex: mIndex, day: d });
                    }
                }
            }
        }
    }
    results.sort((a, b) => a.date - b.date);
    return results;
}

/* -------------------- Mutations -------------------- */
function addTask(year, monthIndex, day, text) {
    const arr = ensureDayArray(year, monthIndex, day);
    arr.push({ id: `${Date.now()}_${Math.random().toString(36).slice(2,7)}`, text, completed: false, createdAt: Date.now() });
    saveUserData();
}
function toggleTask(year, monthIndex, day, id, completed) {
    const arr = ensureDayArray(year, monthIndex, day);
    const idx = arr.findIndex(t => t.id === id);
    if (idx !== -1) {
        arr[idx].completed = !!completed;
        saveUserData();
    }
}
function deleteTask(year, monthIndex, day, id) {
    const arr = ensureDayArray(year, monthIndex, day);
    const next = arr.filter(t => t.id !== id);
    const mk = getMonthKey(year, monthIndex);
    userData.tasks[mk][day] = next;
    saveUserData();
}

/* -------------------- Auth + Boot -------------------- */
loginForm.addEventListener('submit', (e) => {
    e.preventDefault();
    const username = document.getElementById('username').value.trim();
    const password = document.getElementById('password').value;

    if (users[username] && users[username] === password) {
        currentUser = username;
        userData = loadUserData(currentUser);

        loginPage.style.display = 'none';
        calendarPage.style.display = 'block';

        // Prepare UI accents
        injectEnhancedStyles();

        // Update right panel title and hide old inputs if present
        const todoTitle = document.querySelector('#tododev h3');
        if (todoTitle) todoTitle.textContent = 'Upcoming Tasks';
        const newTodo = document.getElementById('newTodo');
        const addTodo = document.getElementById('addTodo');
        if (newTodo) newTodo.style.display = 'none';
        if (addTodo) addTodo.style.display = 'none';

        attachBackupTools();
        renderCalendar();
        renderUpcomingTasks();
    } else {
        loginError.style.display = 'block';
    }
});

function attachBackupTools() {
    const panel = document.getElementById('tododev');
    if (!panel) return;
    let tools = document.getElementById('toolsbar');
    if (tools) return; // already attached

    tools = document.createElement('div');
    tools.id = 'toolsbar';

    const exportBtn = document.createElement('button');
    exportBtn.textContent = 'Download Backup';
    exportBtn.addEventListener('click', () => {
        const blob = new Blob([JSON.stringify(userData, null, 2)], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `${currentUser}_calendar.json`;
        a.click();
        URL.revokeObjectURL(url);
    });

    const importBtn = document.createElement('button');
    importBtn.textContent = 'Restore Backup';
    const fileInput = document.createElement('input');
    fileInput.type = 'file';
    fileInput.accept = 'application/json';
    fileInput.style.display = 'none';
    importBtn.addEventListener('click', () => fileInput.click());
    fileInput.addEventListener('change', async (e) => {
        const f = e.target.files && e.target.files[0];
        if (!f) return;
        try {
            const text = await f.text();
            const data = JSON.parse(text);
            if (!data || typeof data !== 'object' || !data.tasks) throw new Error('Invalid file');
            userData = data;
            saveUserData();
            renderCalendar(currentMonth, currentYear);
            renderUpcomingTasks();
        } catch (err) {
            alert('Failed to import backup: ' + err.message);
        } finally {
            fileInput.value = '';
        }
    });

    tools.appendChild(exportBtn);
    tools.appendChild(importBtn);
    tools.appendChild(fileInput);
    panel.appendChild(tools);
}

/* -------------------- Navigation -------------------- */
leftArrow.addEventListener('click', () => {
    currentYear--;
    renderCalendar(currentMonth, currentYear);
});

rightArrow.addEventListener('click', () => {
    currentYear++;
    renderCalendar(currentMonth, currentYear);
});

monthButtons.forEach((btn, index) => {
    btn.addEventListener('click', () => {
        currentMonth = index;
        renderCalendar(currentMonth, currentYear);
    });
});

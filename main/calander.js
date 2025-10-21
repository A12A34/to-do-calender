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
const todayBtn = document.getElementById('todayBtn');

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

/* Removed injectEnhancedStyles() as styles are now handled in calander.css */

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

    // Set dynamic month label for CSS pseudo-element
    document.documentElement.style.setProperty('--month-label', `"${monthNames[month]}"`);

    // Update active month button
    monthButtons.forEach((btn, idx) => {
        btn.classList.toggle('active', idx === month);
    });
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
        const dateStr = `${monthNames[item.date.getMonth()].slice(0, 3)} ${String(item.date.getDate()).padStart(2, '0')}`;

        const cb = document.createElement('input');
        cb.type = 'checkbox';
        cb.checked = !!item.completed;
        cb.addEventListener('change', () => {
            toggleTask(item.year, item.monthIndex, item.day, item.id, cb.checked);
            renderCalendar(currentMonth, currentYear); // keep UI in sync
            renderUpcomingTasks();
        });

        const text = document.createElement('button');
        text.className = 'task-text';
        text.style.background = 'transparent';
        text.style.border = 'none';
        text.style.textAlign = 'left';
        text.style.cursor = 'pointer';
        text.textContent = `[${dateStr}] ${item.text}`;
        text.addEventListener('click', () => {
            currentYear = item.year;
            currentMonth = item.monthIndex;
            renderCalendar(currentMonth, currentYear);
            // Optionally, scroll to the day if needed later
        });

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
    arr.push({ id: `${Date.now()}_${Math.random().toString(36).slice(2, 7)}`, text, completed: false, createdAt: Date.now() });
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
    const downloadBtn = document.getElementById('downloadBtn');
    const restoreBtn = document.getElementById('restoreBtn');

    if (!downloadBtn || !restoreBtn) return;

    // Remove any existing event listeners by cloning
    const newDownloadBtn = downloadBtn.cloneNode(true);
    const newRestoreBtn = restoreBtn.cloneNode(true);
    downloadBtn.replaceWith(newDownloadBtn);
    restoreBtn.replaceWith(newRestoreBtn);

    // Download backup
    newDownloadBtn.addEventListener('click', () => {
        const blob = new Blob([JSON.stringify(userData, null, 2)], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `${currentUser}_calendar.json`;
        a.click();
        URL.revokeObjectURL(url);
    });

    // Restore backup
    const fileInput = document.createElement('input');
    fileInput.type = 'file';
    fileInput.accept = 'application/json';
    fileInput.style.display = 'none';
    document.body.appendChild(fileInput);

    newRestoreBtn.addEventListener('click', () => fileInput.click());

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
            alert('Backup restored successfully!');
        } catch (err) {
            alert('Failed to import backup: ' + err.message);
        } finally {
            fileInput.value = '';
        }
    });
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

// Today button: jump to current month/year and re-render
if (todayBtn) {
    todayBtn.addEventListener('click', () => {
        const now = new Date();
        currentYear = now.getFullYear();
        currentMonth = now.getMonth();
        renderCalendar(currentMonth, currentYear);
        renderUpcomingTasks();
    });
}

// Search feature: filter tasks across all months
const taskSearchInput = document.getElementById('taskSearch');
const clearSearchBtn = document.getElementById('clearSearch');

function getAllTasksFlat() {
    const results = [];
    for (const mk of Object.keys(userData.tasks || {})) {
        const [yStr, mStr] = mk.split('-');
        const y = parseInt(yStr, 10);
        const mIndex = parseInt(mStr, 10) - 1;
        const daysObj = userData.tasks[mk] || {};
        for (const dStr of Object.keys(daysObj)) {
            const d = parseInt(dStr, 10);
            const list = daysObj[dStr] || [];
            for (const t of list) {
                results.push({ id: t.id, text: t.text, completed: t.completed, year: y, monthIndex: mIndex, day: d, createdAt: t.createdAt });
            }
        }
    }
    return results;
}

function renderSearchResults(query) {
    const list = document.getElementById('todolist');
    if (!list) return;
    const q = (query || '').trim().toLowerCase();
    if (!q) { renderUpcomingTasks(); return; }

    list.innerHTML = '';
    const all = getAllTasksFlat();
    const matches = all.filter(t => t.text && t.text.toLowerCase().includes(q)).sort((a, b) => (a.year - b.year) || (a.monthIndex - b.monthIndex) || (a.day - b.day));
    if (matches.length === 0) {
        const li = document.createElement('li');
        li.textContent = 'No tasks match your search.';
        list.appendChild(li);
        return;
    }
    for (const m of matches) {
        const li = document.createElement('li');
        li.className = 'task-item';
        const date = new Date(m.year, m.monthIndex, m.day);
        const dateStr = `${monthNames[date.getMonth()].slice(0, 3)} ${String(date.getDate()).padStart(2, '0')} ${date.getFullYear()}`;
        const button = document.createElement('button');
        button.className = 'task-text';
        button.style.background = 'transparent';
        button.style.border = 'none';
        button.style.textAlign = 'left';
        button.style.cursor = 'pointer';
        button.textContent = `[${dateStr}] ${m.text}`;
        button.addEventListener('click', () => {
            currentYear = m.year;
            currentMonth = m.monthIndex;
            renderCalendar(currentMonth, currentYear);
            renderUpcomingTasks();
        });
        li.appendChild(button);
        list.appendChild(li);
    }
}

if (taskSearchInput) {
    taskSearchInput.addEventListener('input', (e) => renderSearchResults(e.target.value));
}
if (clearSearchBtn) {
    clearSearchBtn.addEventListener('click', () => {
        if (taskSearchInput) taskSearchInput.value = '';
        renderUpcomingTasks();
    });
}

function getMonthKey(year, monthIndex) {
    return `${year}-${String(monthIndex + 1).padStart(2, '0')}`;
}
function ensureDayArray(year, monthIndex, day) {
    const key = getMonthKey(year, monthIndex);
    if (!userData.tasks[key]) userData.tasks[key] = {};
    if (!userData.tasks[key][day]) userData.tasks[key][day] = [];
    return userData.tasks[key][day];
}
// Enhanced calendar with per-day tasks, upcoming list, and persistent per-user storage

// Simple dictionary of users
const users = {
    'admin': 'admin123',
    'user1': 'pass1',
    'u1': 'p1',
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
const changeAccountBtn = document.getElementById('changeAccountBtn');
// Compact/comfort mode removed
const calendarStats = document.getElementById('calendarStats');

let currentUser = null;
let userData = { tasks: {} }; // tasks: { 'YYYY-MM': { '1': [ {id, text, completed, createdAt} ] } }
let currentFilter = 'all'; // 'all', 'completed', 'incomplete'
// Compact/comfort mode removed
let dataVersion = 0;
let allTasksCache = { version: -1, tasks: [] };
let upcomingCache = { version: -1, windowDays: 0, tasks: [] };
let keyboardShortcutsEnabled = true;

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
// Compact/comfort mode feature fully removed

/* Removed injectEnhancedStyles() as styles are now handled in calander.css */

/* -------------------- Rendering -------------------- */
function renderCalendar(month = currentMonth, year = currentYear) {
    const daysContainer = document.getElementById('daysdev');
    const yearEl = document.getElementById('currentyear');
    const monthLabelEl = document.getElementById('currentMonthLabel');
    if (!daysContainer || !yearEl || !monthLabelEl) return;
    const frag = document.createDocumentFragment();
    daysContainer.innerHTML = '';
    const firstDay = new Date(year, month, 1).getDay();
    const daysInMonth = new Date(year, month + 1, 0).getDate();
    const todayDate = today();

    // Blanks before first day (use .blank so CSS can hide/style them)
    for (let i = 0; i < firstDay; i++) {
        const blankDay = document.createElement('div');
        blankDay.classList.add('day', 'blank');
        blankDay.textContent = '';
        frag.appendChild(blankDay);
    }

    const mk = getMonthKey(year, month);
    const daysWithTasks = new Set();
    let busiestDay = null;
    let maxTasks = 0;
    if (userData.tasks[mk]) {
        for (const dStr of Object.keys(userData.tasks[mk])) {
            const taskCount = userData.tasks[mk][dStr].length;
            if (taskCount > 0) {
                daysWithTasks.add(parseInt(dStr, 10));
                if (taskCount > maxTasks) {
                    maxTasks = taskCount;
                    busiestDay = parseInt(dStr, 10);
                }
            }
        }
    }

    // Actual days
    for (let dayNum = 1; dayNum <= daysInMonth; dayNum++) {
        const dayEl = document.createElement('div');
        dayEl.classList.add('day');
        if (daysWithTasks.has(dayNum)) dayEl.classList.add('has-tasks');
        if (dayNum === busiestDay && maxTasks > 1) dayEl.setAttribute('data-busiest', 'true');
        dayEl.setAttribute('role', 'gridcell');
        dayEl.setAttribute('aria-label', `${monthNames[month]} ${dayNum}, ${year}`);

        if (todayDate.getFullYear() === year && todayDate.getMonth() === month && todayDate.getDate() === dayNum) {
            dayEl.classList.add('today');
            dayEl.setAttribute('aria-current', 'date');
        }

        // Calculate which day of week this date falls on
        const dateObj = new Date(year, month, dayNum);
        const dayOfWeek = dateObj.getDay(); // 0=Sunday, 1=Monday, etc.

        // Day name header (at the top of each day cell)
        const dayNameHeader = document.createElement('div');
        dayNameHeader.className = 'day-name-header';
        dayNameHeader.textContent = daysnames[dayOfWeek];
        dayEl.appendChild(dayNameHeader);

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

        // Priority select
        const prioritySelectEl = document.createElement('select');
        prioritySelectEl.className = 'task-priority-select';
        prioritySelectEl.id = `priority-${year}-${month}-${dayNum}`;
        prioritySelectEl.innerHTML = '<option value="low">Low</option><option value="medium" selected>Medium</option><option value="high">High</option>';

        addBtn.addEventListener('click', () => {
            const val = input.value.trim();
            if (!val) return;
            addTask(year, month, dayNum, val, prioritySelectEl ? prioritySelectEl.value : 'medium');
            input.value = '';
            if (prioritySelectEl) prioritySelectEl.value = 'medium';
            // Re-render day and upcoming list
            renderTasksForDay(list, dayNum, month, year);
            renderUpcomingTasks();
            renderMonthStats(month, year);
        });
        input.addEventListener('keydown', (e) => {
            if (e.key === 'Enter') {
                addBtn.click();
            }
        });

        inputRow.appendChild(input);
        inputRow.appendChild(prioritySelectEl);
        inputRow.appendChild(addBtn);
        dayEl.appendChild(inputRow);

        // Drag-and-drop handlers for rescheduling tasks
        dayEl.addEventListener('dragover', (e) => {
            e.preventDefault();
            e.dataTransfer.dropEffect = 'move';
            dayEl.classList.add('drag-over');
        });

        dayEl.addEventListener('dragleave', (e) => {
            if (e.target === dayEl) {
                dayEl.classList.remove('drag-over');
            }
        });

        dayEl.addEventListener('drop', (e) => {
            e.preventDefault();
            dayEl.classList.remove('drag-over');

            try {
                const data = JSON.parse(e.dataTransfer.getData('text/plain'));
                const { taskId, fromDay, fromMonth, fromYear, taskText } = data;

                // Don't do anything if dropping on same day
                if (fromDay === dayNum && fromMonth === month && fromYear === year) return;

                // Get the task object
                const fromMk = getMonthKey(fromYear, fromMonth);
                const taskList = userData.tasks[fromMk]?.[fromDay];
                if (!taskList) return;

                const taskIndex = taskList.findIndex(t => t.id === taskId);
                if (taskIndex === -1) return;

                const task = taskList[taskIndex];

                // Remove from original day
                taskList.splice(taskIndex, 1);

                // Add to new day (preserve completion and priority)
                addTask(year, month, dayNum, task.text, task.priority || 'medium', !!task.completed);

                // Save and re-render
                saveUserData();
                renderCalendar(currentMonth, currentYear);
                renderUpcomingTasks();
                renderMonthStats(month, year);
            } catch (err) {
                console.error('Drop error:', err);
            }
        });

        frag.appendChild(dayEl);
    }
    yearEl.textContent = year;
    monthLabelEl.textContent = monthNames[month];

    // Set dynamic month label on #daysdev for CSS pseudo-element
    daysContainer.setAttribute('data-month', monthNames[month]);
    daysContainer.appendChild(frag);

    // Update active month button
    const monthBtns = document.querySelectorAll('.monthbutton');
    monthBtns.forEach((btn, idx) => {
        const isActive = idx === month;
        btn.classList.toggle('active', isActive);
        btn.setAttribute('aria-pressed', isActive ? 'true' : 'false');
    });

    renderMonthStats(month, year);
}

function renderTasksForDay(listEl, dayNum, month, year) {
    listEl.innerHTML = '';
    const frag = document.createDocumentFragment();
    const mk = getMonthKey(year, month);
    const tasks = (userData.tasks[mk] && userData.tasks[mk][dayNum]) ? userData.tasks[mk][dayNum] : [];
    tasks.forEach(task => {
        const li = document.createElement('li');
        li.className = 'task-item' + (task.completed ? ' completed' : '');
        li.draggable = true;
        li.setAttribute('data-priority', task.priority || 'medium');
        li.dataset.taskId = task.id;
        li.dataset.day = String(dayNum);
        li.dataset.month = String(month);
        li.dataset.year = String(year);

        li.addEventListener('dragstart', (e) => {
            e.dataTransfer.effectAllowed = 'move';
            e.dataTransfer.setData('text/plain', JSON.stringify({
                taskId: task.id,
                fromDay: dayNum,
                fromMonth: month,
                fromYear: year,
                taskText: task.text
            }));
            li.classList.add('dragging');
        });

        li.addEventListener('dragend', () => {
            li.classList.remove('dragging');
        });

        const cb = document.createElement('input');
        cb.type = 'checkbox';
        cb.checked = !!task.completed;
        cb.setAttribute('aria-label', `Mark ${task.text} as ${task.completed ? 'incomplete' : 'complete'}`);
        cb.addEventListener('change', () => {
            toggleTask(year, month, dayNum, task.id, cb.checked);
            li.classList.toggle('completed', cb.checked);
            renderUpcomingTasks();
            renderMonthStats(currentMonth, currentYear);
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
            renderMonthStats(currentMonth, currentYear);
        });

        actions.appendChild(del);
        li.appendChild(cb);
        li.appendChild(text);
        li.appendChild(actions);
        frag.appendChild(li);
    });
    listEl.appendChild(frag);
}

function renderUpcomingTasks() {
    const list = document.getElementById('todolist');
    if (!list) return;
    list.innerHTML = '';
    const frag = document.createDocumentFragment();
    const upcoming = collectUpcomingTasks(7); // next 7 days

    // Apply current filter
    const filtered = upcoming.filter(item => {
        if (currentFilter === 'completed') return item.completed;
        if (currentFilter === 'incomplete') return !item.completed;
        return true; // 'all'
    });

    if (filtered.length === 0) {
        const li = document.createElement('li');
        li.textContent = currentFilter === 'all'
            ? 'No upcoming tasks in the next 7 days.'
            : `No ${currentFilter} tasks in the next 7 days.`;
        list.appendChild(li);
        return;
    }

    filtered.forEach(item => {
        const li = document.createElement('li');
        li.className = 'task-item';
        li.setAttribute('data-priority', item.priority || 'medium');
        const dateStr = `${monthNames[item.date.getMonth()].slice(0, 3)} ${String(item.date.getDate()).padStart(2, '0')}`;

        const cb = document.createElement('input');
        cb.type = 'checkbox';
        cb.checked = !!item.completed;
        cb.setAttribute('aria-label', `Mark ${item.text} as ${item.completed ? 'incomplete' : 'complete'}`);
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
        text.setAttribute('aria-label', `Jump to ${item.text} on ${dateStr}`);
        text.addEventListener('click', () => {
            currentYear = item.year;
            currentMonth = item.monthIndex;
            renderCalendar(currentMonth, currentYear);
            // Optionally, scroll to the day if needed later
        });

        li.appendChild(cb);
        li.appendChild(text);
        frag.appendChild(li);
    });
    list.appendChild(frag);
}

function collectUpcomingTasks(windowDays = 7) {
    if (upcomingCache.version === dataVersion && upcomingCache.windowDays === windowDays) {
        return upcomingCache.tasks;
    }
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
    upcomingCache = { version: dataVersion, windowDays, tasks: results };
    return results;
}

/* -------------------- Mutations -------------------- */
function addTask(year, monthIndex, day, text, priority = 'medium', completed = false) {
    const arr = ensureDayArray(year, monthIndex, day);
    arr.push({ id: `${Date.now()}_${Math.random().toString(36).slice(2, 7)}`, text, completed: completed, createdAt: Date.now(), priority });
    saveUserData();
    dataVersion++;
}
function toggleTask(year, monthIndex, day, id, completed) {
    const arr = ensureDayArray(year, monthIndex, day);
    const idx = arr.findIndex(t => t.id === id);
    if (idx !== -1) {
        arr[idx].completed = !!completed;
        saveUserData();
        dataVersion++;
    }
}
function deleteTask(year, monthIndex, day, id) {
    const arr = ensureDayArray(year, monthIndex, day);
    const next = arr.filter(t => t.id !== id);
    const mk = getMonthKey(year, monthIndex);
    userData.tasks[mk][day] = next;
    saveUserData();
    dataVersion++;
}

/* -------------------- Auth + Boot -------------------- */
function bootCalendarForUser(username) {
    currentUser = username;
    userData = loadUserData(currentUser);

    if (loginPage) loginPage.style.display = 'none';
    if (calendarPage) calendarPage.style.display = 'block';

    // Update right panel title and hide old inputs if present
    const todoTitle = document.querySelector('#tododev h3');
    if (todoTitle) todoTitle.textContent = 'Upcoming Tasks';
    const newTodo = document.getElementById('newTodo');
    const addTodo = document.getElementById('addTodo');
    if (newTodo) newTodo.style.display = 'none';
    if (addTodo) addTodo.style.display = 'none';

    attachBackupTools();
    attachFilterButtons();
    renderCalendar();
    renderUpcomingTasks();
}

// Standard login flow
if (loginForm) {
    loginForm.addEventListener('submit', (e) => {
        e.preventDefault();
        const username = document.getElementById('username').value.trim().toLowerCase();
        const password = document.getElementById('password').value;

        if (users[username] && users[username] === password) {
            try { localStorage.setItem('calendar_last_user', username); } catch { }
            bootCalendarForUser(username);
        } else {
            loginError.style.display = 'block';
        }
    });
}

// Auto-boot if a previous user exists (improves UX and avoids blank calendar states)
try {
    const lastUser = localStorage.getItem('calendar_last_user');
    if (lastUser && typeof lastUser === 'string' && lastUser.trim()) {
        bootCalendarForUser(lastUser.trim());
    }
} catch { }

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

function attachFilterButtons() {
    const filterButtons = document.querySelectorAll('.filter-btn');
    filterButtons.forEach(btn => {
        btn.addEventListener('click', () => {
            // Update active state
            filterButtons.forEach(b => {
                b.classList.remove('active');
                b.setAttribute('aria-pressed', 'false');
            });
            btn.classList.add('active');
            btn.setAttribute('aria-pressed', 'true');

            // Update current filter
            currentFilter = btn.dataset.filter;

            // Re-render the task list
            const searchInput = document.getElementById('taskSearch');
            if (searchInput && searchInput.value.trim()) {
                renderSearchResults(searchInput.value);
            } else {
                renderUpcomingTasks();
            }
        });
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

// Change account: return to login screen and clear last user
if (changeAccountBtn) {
    // Remove existing listeners by cloning
    const cloned = changeAccountBtn.cloneNode(true);
    changeAccountBtn.replaceWith(cloned);
    cloned.addEventListener('click', () => {
        try { localStorage.removeItem('calendar_last_user'); } catch { }
        currentUser = null;
        if (calendarPage) calendarPage.style.display = 'none';
        if (loginPage) {
            loginPage.style.display = 'block';
            const user = document.getElementById('username');
            const pass = document.getElementById('password');
            if (user) user.value = '';
            if (pass) pass.value = '';
            if (loginError) loginError.style.display = 'none';
            if (user) user.focus();
        }
    });
}

// Search feature: filter tasks across all months
const taskSearchInput = document.getElementById('taskSearch');
const clearSearchBtn = document.getElementById('clearSearch');

function getAllTasksFlat() {
    if (allTasksCache.version === dataVersion) return allTasksCache.tasks;
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
    allTasksCache = { version: dataVersion, tasks: results };
    return results;
}

function renderSearchResults(query) {
    const list = document.getElementById('todolist');
    if (!list) return;
    const q = (query || '').trim().toLowerCase();
    if (!q) { renderUpcomingTasks(); return; }

    list.innerHTML = '';
    const all = getAllTasksFlat();

    // Apply search and filter
    let matches = all.filter(t => t.text && t.text.toLowerCase().includes(q));

    // Apply current filter
    matches = matches.filter(t => {
        if (currentFilter === 'completed') return t.completed;
        if (currentFilter === 'incomplete') return !t.completed;
        return true; // 'all'
    });

    matches.sort((a, b) => (a.year - b.year) || (a.monthIndex - b.monthIndex) || (a.day - b.day));

    if (matches.length === 0) {
        const li = document.createElement('li');
        li.textContent = 'No tasks match your search.';
        list.appendChild(li);
        return;
    }
    const frag = document.createDocumentFragment();
    for (const m of matches) {
        const li = document.createElement('li');
        li.className = 'task-item';
        if (m.completed) li.classList.add('completed');

        const date = new Date(m.year, m.monthIndex, m.day);
        const dateStr = `${monthNames[date.getMonth()].slice(0, 3)} ${String(date.getDate()).padStart(2, '0')} ${date.getFullYear()}`;

        const cb = document.createElement('input');
        cb.type = 'checkbox';
        cb.checked = !!m.completed;
        cb.setAttribute('aria-label', `Mark ${m.text} as ${m.completed ? 'incomplete' : 'complete'}`);
        cb.addEventListener('change', () => {
            toggleTask(m.year, m.monthIndex, m.day, m.id, cb.checked);
            renderSearchResults(query);
        });

        const button = document.createElement('button');
        button.className = 'task-text';
        button.style.background = 'transparent';
        button.style.border = 'none';
        button.style.textAlign = 'left';
        button.style.cursor = 'pointer';
        button.textContent = `[${dateStr}] ${m.text}`;
        button.setAttribute('aria-label', `Jump to ${m.text} on ${dateStr}`);
        button.addEventListener('click', () => {
            currentYear = m.year;
            currentMonth = m.monthIndex;
            renderCalendar(currentMonth, currentYear);
            renderUpcomingTasks();
        });

        li.appendChild(cb);
        li.appendChild(button);
        frag.appendChild(li);
    }
    list.appendChild(frag);
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

// Initialize global UI affordances
initReducedMotionWatcher();

// Keyboard shortcuts
function initKeyboardShortcuts() {
    document.addEventListener('keydown', (e) => {
        // Ignore if typing in an input
        if (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA') return;

        switch (e.key.toLowerCase()) {
            case 'arrowleft':
                e.preventDefault();
                if (currentMonth === 0) {
                    currentMonth = 11;
                    currentYear--;
                } else {
                    currentMonth--;
                }
                renderCalendar(currentMonth, currentYear);
                break;
            case 'arrowright':
                e.preventDefault();
                if (currentMonth === 11) {
                    currentMonth = 0;
                    currentYear++;
                } else {
                    currentMonth++;
                }
                renderCalendar(currentMonth, currentYear);
                break;
            case 'arrowup':
                e.preventDefault();
                currentYear--;
                renderCalendar(currentMonth, currentYear);
                break;
            case 'arrowdown':
                e.preventDefault();
                currentYear++;
                renderCalendar(currentMonth, currentYear);
                break;
            case 't':
            case 'h':
                e.preventDefault();
                if (todayBtn) todayBtn.click();
                break;
            case '/':
                e.preventDefault();
                const searchInput = document.getElementById('taskSearch');
                if (searchInput) searchInput.focus();
                break;
            case 'escape':
                const searchInput2 = document.getElementById('taskSearch');
                if (searchInput2) {
                    searchInput2.value = '';
                    searchInput2.blur();
                    renderUpcomingTasks();
                }
                break;
            // 'c' for compact removed
        }
    });
}

initKeyboardShortcuts();

function renderMonthStats(month, year) {
    if (!calendarStats) return;
    const mk = getMonthKey(year, month);
    const daysObj = userData.tasks[mk] || {};
    let total = 0;
    let active = 0;
    let completed = 0;
    let busiestDay = null;
    let maxCount = 0;

    for (const dStr of Object.keys(daysObj)) {
        const tasks = daysObj[dStr] || [];
        total += tasks.length;
        for (const t of tasks) {
            if (t.completed) completed++;
            else active++;
        }
        if (tasks.length > maxCount) {
            maxCount = tasks.length;
            busiestDay = parseInt(dStr, 10);
        }
    }

    const totalEl = calendarStats.querySelector('[data-stat="total"] .stat-value');
    const activeEl = calendarStats.querySelector('[data-stat="active"] .stat-value');
    const completedEl = calendarStats.querySelector('[data-stat="completed"] .stat-value');
    const busiestEl = calendarStats.querySelector('[data-stat="busiest"] .stat-value');

    if (totalEl) totalEl.textContent = total;
    if (activeEl) activeEl.textContent = active;
    if (completedEl) completedEl.textContent = completed;
    if (busiestEl) busiestEl.textContent = busiestDay ? `Day ${busiestDay}` : '—';
}

// Ensure the calendar grid is rendered at least once on load,
// so users always see the year, month buttons, and day cells
// even before logging in. Authenticated users will trigger another
// render via bootCalendarForUser.
try {
    renderCalendar(currentMonth, currentYear);
    renderUpcomingTasks();
} catch (e) {
    console.warn('Initial render failed (will render after login):', e);
}

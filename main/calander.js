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

// Simple dictionary of users - now stored in localStorage
let users = JSON.parse(localStorage.getItem('calendarUsers') || '{"admin": "admin123", "user1": "pass1", "u1": "p1"}');

function saveUsers() {
    localStorage.setItem('calendarUsers', JSON.stringify(users));
}

// Elements (available because script is defer)
const loginForm = document.getElementById('loginForm');
const registerForm = document.getElementById('registerForm');
const loginTab = document.getElementById('loginTab');
const registerTab = document.getElementById('registerTab');
const loginSection = document.getElementById('loginSection');
const registerSection = document.getElementById('registerSection');
const loginError = document.getElementById('loginError');
const registerError = document.getElementById('registerError');
const registerSuccess = document.getElementById('registerSuccess');
const loginPage = document.getElementById('loginPage');
const calendarPage = document.getElementById('calendarPage');

const leftArrow = document.getElementById('left_arrow');
const rightArrow = document.getElementById('right_arrow');
const currentYearEl = document.getElementById('currentyear');
const daysDev = document.getElementById('daysdev');
const monthButtons = document.querySelectorAll('.monthbutton');
const todayBtn = document.getElementById('todayBtn');
const changeAccountBtn = document.getElementById('changeAccountBtn');
const currentUserDisplay = document.getElementById('currentUserDisplay');
// Compact/comfort mode removed
const calendarStats = document.getElementById('calendarStats');

let currentUser = null;
let userData = { tasks: {} }; // tasks: { 'YYYY-MM': { '1': [ {id, text, completed, createdAt, time, recurring, priority} ] } }
let currentFilter = 'all'; // 'all', 'completed', 'incomplete'
// Compact/comfort mode removed
let dataVersion = 0;
let allTasksCache = { version: -1, tasks: [] };
let upcomingCache = { version: -1, windowDays: 0, tasks: [] };
let keyboardShortcutsEnabled = true;
let filtersInitialized = false;
let dailyTasksProcessed = false;

let currentYear = new Date().getFullYear();
let currentMonth = new Date().getMonth(); // 0-11

const monthNames = [
    'January', 'February', 'March', 'April', 'May', 'June',
    'July', 'August', 'September', 'October', 'November', 'December'
];
const daysnames = [
    'Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'
];

/* -------------------- Background image (random each load) -------------------- */
const BG_IMAGES = [
    'ed82529805250b004815da6debb66851.png',
    'pexels-bri-schneiter-28802-346529.jpg',
    'pexels-elti-meshau-107925-333850.jpg',
    'pexels-enginakyurt-1435752.jpg',
    'pexels-gdtography-277628-911738.jpg',
    'pexels-irina-634548.jpg',
    'pexels-jplenio-1103970.jpg',
    'pexels-junior-teixeira-1064069-2047905.jpg',
    'pexels-lum3n-44775-295771.jpg',
    'pexels-magda-ehlers-pexels-960137.jpg',
    'pexels-nickcollins-1292998.jpg',
    'pexels-pixabay-268533.jpg',
    'pexels-pixabay-289586.jpg',
    'pexels-pixabay-326333.jpg',
    'pexels-pixabay-33545.jpg',
    'pexels-scottwebb-1022928.jpg',
    'pexels-souvenirpixels-417074.jpg',
    'pexels-umaraffan499-22794.jpg',
    'pexels-zaksheuskaya-709412-1616403.jpg',
];

let __bgApplied = false;
function setRandomBackground() {
    if (__bgApplied) return;
    try {
        if (!document || !document.body) return;
        const idx = Math.floor(Math.random() * BG_IMAGES.length);
        const src = `/main/bg/${BG_IMAGES[idx]}`;
        const b = document.body;
        b.style.backgroundImage = `url('${src}')`;
        b.style.backgroundRepeat = 'no-repeat';
        b.style.backgroundAttachment = 'fixed';
        b.style.backgroundSize = 'cover';
        b.style.backgroundPosition = 'center';
        __bgApplied = true;
    } catch { }
}

// Apply immediately (script is defer) and also on window load as a fallback
setRandomBackground();
window.addEventListener('load', setRandomBackground);

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

function saveUserData() {
    if (!currentUser) return;
    try {
        localStorage.setItem(storageKeyFor(currentUser), JSON.stringify(userData));
    } catch (err) {
        console.error('Failed saving calendar data', err);
    }
}

function startOfDay(date) {
    const d = new Date(date);
    d.setHours(0, 0, 0, 0);
    return d;
}

function today() {
    return startOfDay(new Date());
}

function initReducedMotionWatcher() {
    if (!window.matchMedia) return;
    const mq = window.matchMedia('(prefers-reduced-motion: reduce)');
    const apply = () => {
        const reduced = mq.matches;
        keyboardShortcutsEnabled = !reduced;
        document.documentElement.classList.toggle('reduce-motion', reduced);
    };
    apply();
    if (typeof mq.addEventListener === 'function') {
        mq.addEventListener('change', apply);
    } else if (typeof mq.addListener === 'function') {
        mq.addListener(apply);
    }
}

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

        // Priority select
        const prioritySelectEl = document.createElement('select');
        prioritySelectEl.className = 'task-priority-select';
        prioritySelectEl.id = `priority-${year}-${month}-${dayNum}`;
        prioritySelectEl.innerHTML = '<option value="low">Low</option><option value="medium" selected>Medium</option><option value="high">High</option>';

        // Time input
        const timeInputEl = document.createElement('input');
        timeInputEl.type = 'time';
        timeInputEl.className = 'task-time-input';
        timeInputEl.id = `time-${year}-${month}-${dayNum}`;

        // Recurring checkbox
        const recurringLabelEl = document.createElement('label');
        recurringLabelEl.className = 'task-recurring-label';
        const recurringCheckEl = document.createElement('input');
        recurringCheckEl.type = 'checkbox';
        recurringCheckEl.className = 'task-recurring-check';
        recurringCheckEl.id = `recurring-${year}-${month}-${dayNum}`;
        const recurringTextEl = document.createElement('span');
        recurringTextEl.textContent = 'Daily';
        recurringLabelEl.appendChild(recurringCheckEl);
        recurringLabelEl.appendChild(recurringTextEl);

        const handleTaskAdd = () => {
            const val = input.value.trim();
            if (!val) return;
            addTask(year, month, dayNum, val, prioritySelectEl ? prioritySelectEl.value : 'medium', false, timeInputEl.value, recurringCheckEl.checked);
            input.value = '';
            if (prioritySelectEl) prioritySelectEl.value = 'medium';
            timeInputEl.value = '';
            recurringCheckEl.checked = false;
            // Re-render day and upcoming list
            renderTasksForDay(list, dayNum, month, year);
            renderUpcomingTasks();
            renderMonthStats(month, year);
            input.focus();
        };

        input.addEventListener('keydown', (e) => {
            if (e.key === 'Enter') {
                e.preventDefault();
                handleTaskAdd();
            }
        });
        prioritySelectEl.addEventListener('keydown', (e) => {
            if (e.key === 'Enter') {
                e.preventDefault();
                handleTaskAdd();
            }
        });
        timeInputEl.addEventListener('keydown', (e) => {
            if (e.key === 'Enter') {
                e.preventDefault();
                handleTaskAdd();
            }
        });

        inputRow.appendChild(input);
        inputRow.appendChild(timeInputEl);
        inputRow.appendChild(prioritySelectEl);
        inputRow.appendChild(recurringLabelEl);
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

        // Display time if available
        if (task.time) {
            const timeSpan = document.createElement('span');
            timeSpan.className = 'task-time-badge';
            timeSpan.textContent = task.time;
            text.appendChild(timeSpan);
            text.appendChild(document.createTextNode(' '));
        }

        // Display recurring badge if daily
        if (task.recurring) {
            const recurringSpan = document.createElement('span');
            recurringSpan.className = 'task-recurring-badge';
            recurringSpan.textContent = '↻';
            recurringSpan.title = 'Daily recurring task';
            text.appendChild(recurringSpan);
            text.appendChild(document.createTextNode(' '));
        }

        text.appendChild(document.createTextNode(task.text));

        const actions = document.createElement('span');
        actions.className = 'task-actions';

        // Edit button
        const edit = document.createElement('button');
        edit.className = 'task-btn edit';
        edit.title = 'Edit task';
        edit.textContent = '✎';
        edit.addEventListener('click', () => {
            const newText = prompt('Edit task:', task.text);
            if (newText && newText.trim()) {
                updateTask(year, month, dayNum, task.id, { text: newText.trim() });
                renderTasksForDay(listEl, dayNum, month, year);
                renderUpcomingTasks();
            }
        });

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

        actions.appendChild(edit);
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

        // Calculate days until task
        const daysUntil = Math.ceil((item.date - today()) / (1000 * 60 * 60 * 24));
        const countdownBadge = daysUntil === 0 ? '(Today)' : daysUntil === 1 ? '(Tomorrow)' : `(${daysUntil}d)`;

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

        // Build text content with time and countdown
        let textContent = `[${dateStr}] `;
        if (item.time) {
            textContent += `${item.time} `;
        }
        if (item.recurring) {
            textContent += '↻ ';
        }
        textContent += `${item.text} ${countdownBadge}`;
        text.textContent = textContent;

        text.setAttribute('aria-label', `Jump to ${item.text} on ${dateStr}`);
        text.addEventListener('click', () => {
            currentYear = item.year;
            currentMonth = item.monthIndex;
            renderCalendar(currentMonth, currentYear);
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
function addTask(year, monthIndex, day, text, priority = 'medium', completed = false, time = '', recurring = false) {
    const arr = ensureDayArray(year, monthIndex, day);
    arr.push({
        id: `${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
        text,
        completed: completed,
        createdAt: Date.now(),
        priority,
        time: time || '',
        recurring: recurring || false
    });
    sortTaskArray(arr);
    saveUserData();
    dataVersion++;
}

function sortTaskArray(arr) {
    const priorityOrder = { high: 0, medium: 1, low: 2 };
    arr.sort((a, b) => {
        // First sort by completion status (incomplete first)
        if (a.completed !== b.completed) return a.completed ? 1 : -1;

        // Then by priority
        const priorityDiff = priorityOrder[a.priority || 'medium'] - priorityOrder[b.priority || 'medium'];
        if (priorityDiff !== 0) return priorityDiff;

        // Then by time if available
        if (a.time && b.time) {
            return a.time.localeCompare(b.time);
        }
        if (a.time) return -1;
        if (b.time) return 1;

        // Finally by creation time
        return a.createdAt - b.createdAt;
    });
}

function updateTask(year, monthIndex, day, id, updates) {
    const arr = ensureDayArray(year, monthIndex, day);
    const idx = arr.findIndex(t => t.id === id);
    if (idx !== -1) {
        arr[idx] = { ...arr[idx], ...updates };
        sortTaskArray(arr);
        saveUserData();
        dataVersion++;
    }
}

function toggleTask(year, monthIndex, day, id, completed) {
    updateTask(year, monthIndex, day, id, { completed: !!completed });
}

function deleteTask(year, monthIndex, day, id) {
    const arr = ensureDayArray(year, monthIndex, day);
    const next = arr.filter(t => t.id !== id);
    const mk = getMonthKey(year, monthIndex);
    userData.tasks[mk][day] = next;
    saveUserData();
    dataVersion++;
}

function processDailyTasks() {
    if (dailyTasksProcessed) return;
    const todayObj = today();
    const todayKey = getMonthKey(todayObj.getFullYear(), todayObj.getMonth());
    const todayDay = todayObj.getDate();

    // Copy all recurring daily tasks to today if they don't already exist
    for (const mk of Object.keys(userData.tasks || {})) {
        const daysObj = userData.tasks[mk];
        for (const dStr of Object.keys(daysObj)) {
            const tasks = daysObj[dStr];
            tasks.forEach(task => {
                if (task.recurring && !task.completed) {
                    // Check if this task already exists for today
                    const todayTasks = userData.tasks[todayKey]?.[todayDay] || [];
                    const exists = todayTasks.some(t => t.text === task.text && t.recurring);
                    if (!exists && (mk !== todayKey || parseInt(dStr) !== todayDay)) {
                        addTask(todayObj.getFullYear(), todayObj.getMonth(), todayDay,
                            task.text, task.priority, false, task.time, true);
                    }
                }
            });
        }
    }
    dailyTasksProcessed = true;
}

/* -------------------- Auth + Boot -------------------- */
function bootCalendarForUser(username) {
    currentUser = username;
    userData = loadUserData(currentUser);
    dataVersion++;
    allTasksCache = { version: -1, tasks: [] };
    upcomingCache = { version: -1, windowDays: 0, tasks: [] };

    const now = today();
    currentYear = now.getFullYear();
    currentMonth = now.getMonth();
    if (currentUserDisplay) {
        const prettyName = username && username.length ? username.charAt(0).toUpperCase() + username.slice(1) : 'User';
        currentUserDisplay.textContent = `Signed in as ${prettyName}`;
    }

    if (loginPage) loginPage.style.display = 'none';
    if (calendarPage) calendarPage.style.display = 'block';
    if (loginError) loginError.style.display = 'none';

    // Update right panel title and hide old inputs if present
    const todoTitle = document.querySelector('#tododev h3');
    if (todoTitle) todoTitle.textContent = 'Upcoming Tasks';
    const newTodo = document.getElementById('newTodo');
    const addTodo = document.getElementById('addTodo');
    if (newTodo) newTodo.style.display = 'none';
    if (addTodo) addTodo.style.display = 'none';

    attachBackupTools();
    attachFilterButtons();
    processDailyTasks(); // Process daily recurring tasks
    renderCalendar(currentMonth, currentYear);
    renderUpcomingTasks();
}

// Tab switching for login/register
if (loginTab && registerTab && loginSection && registerSection) {
    loginTab.addEventListener('click', () => {
        loginTab.classList.add('active');
        registerTab.classList.remove('active');
        loginSection.style.display = 'block';
        registerSection.style.display = 'none';
    });

    registerTab.addEventListener('click', () => {
        registerTab.classList.add('active');
        loginTab.classList.remove('active');
        registerSection.style.display = 'block';
        loginSection.style.display = 'none';
    });
}

// Registration form
if (registerForm) {
    registerForm.addEventListener('submit', (e) => {
        e.preventDefault();
        const username = document.getElementById('newUsername').value.trim().toLowerCase();
        const password = document.getElementById('newPassword').value;
        const confirmPassword = document.getElementById('confirmPassword').value;

        if (registerError) registerError.style.display = 'none';
        if (registerSuccess) registerSuccess.style.display = 'none';

        // Validation
        if (username.length < 3) {
            if (registerError) {
                registerError.textContent = 'Username must be at least 3 characters';
                registerError.style.display = 'block';
            }
            return;
        }

        if (password.length < 4) {
            if (registerError) {
                registerError.textContent = 'Password must be at least 4 characters';
                registerError.style.display = 'block';
            }
            return;
        }

        if (password !== confirmPassword) {
            if (registerError) {
                registerError.textContent = 'Passwords do not match';
                registerError.style.display = 'block';
            }
            return;
        }

        if (users[username]) {
            if (registerError) {
                registerError.textContent = 'Username already exists';
                registerError.style.display = 'block';
            }
            return;
        }

        // Create account
        users[username] = password;
        saveUsers();

        if (registerSuccess) registerSuccess.style.display = 'block';

        // Clear form
        document.getElementById('newUsername').value = '';
        document.getElementById('newPassword').value = '';
        document.getElementById('confirmPassword').value = '';

        // Switch to login tab after 1.5 seconds
        setTimeout(() => {
            if (loginTab) loginTab.click();
        }, 1500);
    });
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
    if (filtersInitialized) return;
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
    filtersInitialized = true;
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
        userData = { tasks: {} };
        allTasksCache = { version: -1, tasks: [] };
        upcomingCache = { version: -1, windowDays: 0, tasks: [] };
        dataVersion++;
        if (currentUserDisplay) currentUserDisplay.textContent = 'Not signed in';
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
        if (daysDev) daysDev.innerHTML = '';
        const todoList = document.getElementById('todolist');
        if (todoList) todoList.innerHTML = '';
        const statValues = calendarStats ? calendarStats.querySelectorAll('.stat-value') : null;
        if (statValues) {
            statValues.forEach((el, idx) => {
                if (idx === 3) el.textContent = '—';
                else el.textContent = '0';
            });
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
        if (!keyboardShortcutsEnabled) return;

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

    // Calculate next upcoming event with countdown
    const nextEventEl = document.getElementById('nextEventCountdown');
    if (nextEventEl) {
        const upcoming = collectUpcomingTasks(365).filter(t => !t.completed);
        if (upcoming.length > 0) {
            const next = upcoming[0];
            const daysUntil = Math.ceil((next.date - today()) / (1000 * 60 * 60 * 24));
            if (daysUntil === 0) {
                nextEventEl.textContent = 'Today!';
                nextEventEl.style.color = 'var(--accent-4)';
            } else if (daysUntil === 1) {
                nextEventEl.textContent = 'Tomorrow';
                nextEventEl.style.color = 'var(--accent-3)';
            } else {
                nextEventEl.textContent = `${daysUntil} days`;
                nextEventEl.style.color = 'var(--ink)';
            }
        } else {
            nextEventEl.textContent = '—';
            nextEventEl.style.color = 'var(--ink)';
        }
    }
}


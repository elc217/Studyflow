const STORAGE_KEYS = {
  tasks: 'studyflow-tasks',
  tests: 'studyflow-test-history',
  notes: 'studyflow-notes',
};

const SUPABASE_URL = 'https://ymlinhhriprtyhaamsrz.supabase.co';
const SUPABASE_ANON_KEY = 'sb_publishable_i4lrF89M1YcyFmkjY9s_JA_zLA7MMOC';
const supabaseClient = window.supabase?.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
let currentUser = null;
let currentProfile = null;

function formatDate(date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

function addDays(date, days) {
  const copy = new Date(date);
  copy.setDate(copy.getDate() + days);
  return formatDate(copy);
}

function timeToMinutes(value) {
  const [hours = 9, minutes = 0] = String(value || '09:00').split(':').map(Number);
  return hours * 60 + minutes;
}

function minutesToTime(minutes) {
  const total = Math.max(0, Number(minutes) || 0);
  const h = String(Math.floor(total / 60)).padStart(2, '0');
  const m = String(total % 60).padStart(2, '0');
  return `${h}:${m}`;
}

function getStartOfWeek(date) {
  const copy = new Date(date);
  const day = copy.getDay();
  const diff = (day === 0 ? -6 : 1 - day);
  copy.setDate(copy.getDate() + diff);
  copy.setHours(0, 0, 0, 0);
  return copy;
}

function getWeekDates(startDate) {
  return Array.from({ length: 7 }, (_, index) => {
    const date = new Date(startDate);
    date.setDate(startDate.getDate() + index);
    return formatDate(date);
  });
}

function formatDisplayDate(dateString) {
  const date = new Date(`${dateString}T00:00:00`);
  return new Intl.DateTimeFormat('es-ES', { weekday: 'short', day: 'numeric', month: 'short' }).format(date);
}

const defaultTasks = [];
const sampleTaskIds = new Set(['task-1', 'task-2', 'task-3']);

const defaultTestHistory = [
  { id: 'test-1', subject: 'Matemáticas', date: formatDate(new Date()), correct: 8, incorrect: 2 },
  { id: 'test-2', subject: 'Biología', date: addDays(new Date(), -1), correct: 6, incorrect: 4 },
];

const defaultNotes = [
  {
    id: 'note-1',
    subject: 'Química',
    topic: 'Regla del octeto',
    taskId: '',
    text: 'Me confundí al distinguir enlace simple y enlace doble. Repetir con un esquema visual antes del próximo test.',
    createdAt: formatDate(new Date()),
    date: formatDate(new Date()),
  },
];

const state = {
  tasks: loadData(STORAGE_KEYS.tasks, defaultTasks).filter((task) => !sampleTaskIds.has(task.id)).map(normalizeTask),
  tests: loadData(STORAGE_KEYS.tests, defaultTestHistory),
  notes: loadData(STORAGE_KEYS.notes, defaultNotes).map(normalizeNote),
  filter: 'all',
  selectedMinutes: 25,
  timerSeconds: 25 * 60,
  isRunning: false,
  timerInterval: null,
  editingTaskId: null,
  editMode: false,
  weekStart: getStartOfWeek(new Date()),
  selectedDate: formatDate(new Date()),
};

const refs = {
  taskForm: document.querySelector('#taskForm'),
  taskFormSubmit: document.querySelector('#taskForm button[type="submit"]'),
  taskFormWrap: document.querySelector('#taskFormWrap'),
  addTaskButton: document.querySelector('#addTaskButton'),
  editCalendarButton: document.querySelector('#editCalendarButton'),
  prevWeek: document.querySelector('#prevWeek'),
  nextWeek: document.querySelector('#nextWeek'),
  statTotal: document.querySelector('#statTotal'),
  statDone: document.querySelector('#statDone'),
  statMinutes: document.querySelector('#statMinutes'),
  statToday: document.querySelector('#statToday'),
  nextTask: document.querySelector('#nextTask'),
  nextTaskMeta: document.querySelector('#nextTaskMeta'),
  nextTaskTime: document.querySelector('#nextTaskTime'),
  weekLabel: document.querySelector('#weekLabel'),
  calendarGrid: document.querySelector('#calendarGrid'),
  dayDetailHeader: document.querySelector('#dayDetailHeader'),
  dayDetailList: document.querySelector('#dayDetailList'),
  choosePlanFile: document.querySelector('#choosePlanFile'),
  planFileInput: document.querySelector('#planFileInput'),
  planMarkdown: document.querySelector('#planMarkdown'),
  importPlanButton: document.querySelector('#importPlanButton'),
  loadExamplePlan: document.querySelector('#loadExamplePlan'),
  exportBackupButton: document.querySelector('#exportBackupButton'),
  restoreBackupButton: document.querySelector('#restoreBackupButton'),
  backupFileInput: document.querySelector('#backupFileInput'),
  loadedPlanLabel: document.querySelector('#loadedPlanLabel'),
  testForm: document.querySelector('#testForm'),
  testHistoryList: document.querySelector('#testHistoryList'),
  accuracyMetric: document.querySelector('#accuracyMetric'),
  failuresMetric: document.querySelector('#failuresMetric'),
  noteForm: document.querySelector('#noteForm'),
  noteTask: document.querySelector('#noteTask'),
  noteSearch: document.querySelector('#noteSearch'),
  notesList: document.querySelector('#notesList'),
  timerDisplay: document.querySelector('#timerDisplay'),
  startTimer: document.querySelector('#startTimer'),
  resetTimer: document.querySelector('#resetTimer'),
  applyCustomTimer: document.querySelector('#applyCustomTimer'),
  customTimerMinutes: document.querySelector('#customTimerMinutes'),
  reviewSuggestions: document.querySelector('#reviewSuggestions'),
  timerButtons: [...document.querySelectorAll('.timer-btn')],
  navButtons: [...document.querySelectorAll('.nav-item')],
  authPanel: document.querySelector('#authPanel'),
  authForm: document.querySelector('#authForm'),
  authEmail: document.querySelector('#authEmail'),
  authPassword: document.querySelector('#authPassword'),
  authSubmit: document.querySelector('#authSubmit'),
  authToggle: document.querySelector('#authToggle'),
  authMessage: document.querySelector('#authMessage'),
  userEmail: document.querySelector('#userEmail'),
  signOutButton: document.querySelector('#signOutButton'),
  signOutSidebarButton: document.querySelector('#signOutSidebarButton'),
  manualButton: document.querySelector('#manualButton'),
  adminButton: document.querySelector('#adminButton'),
  manualPanel: document.querySelector('#manualPanel'),
  adminPanel: document.querySelector('#adminPanel'),
  adminUserCount: document.querySelector('#adminUserCount'),
  adminActivityCount: document.querySelector('#adminActivityCount'),
  adminUsersList: document.querySelector('#adminUsersList'),
  adminMessage: document.querySelector('#adminMessage'),
  refreshAdminButton: document.querySelector('#refreshAdminButton'),
};

function loadData(key, fallback) {
  try {
    const raw = localStorage.getItem(key);
    if (!raw) return fallback;
    const data = JSON.parse(raw);
    return Array.isArray(data) && data.length ? data : fallback;
  } catch (error) {
    return fallback;
  }
}

function saveData(key, value) {
  localStorage.setItem(key, JSON.stringify(value));
  if (currentUser && supabaseClient) syncCollection(key, value);
}

const remoteTables = {
  [STORAGE_KEYS.tasks]: 'tasks',
  [STORAGE_KEYS.tests]: 'tests',
  [STORAGE_KEYS.notes]: 'notes',
};

function toRemoteRow(table, item) {
  if (table === 'tasks') {
    return { id: item.id, user_id: currentUser.id, title: item.title, subject: item.subject, duration: item.duration, date: item.date, start_time: item.startTime, priority: item.priority, status: item.status, completed: item.completed, difficulty: item.difficulty, needs_review: item.needsReview };
  }
  if (table === 'tests') return { id: item.id, user_id: currentUser.id, subject: item.subject, date: item.date, correct: item.correct, incorrect: item.incorrect };
  return { id: item.id, user_id: currentUser.id, subject: item.subject, topic: item.topic, task_id: item.taskId || null, text: item.text, date: item.date, difficulty: item.difficulty, needs_review: item.needsReview };
}

function fromRemoteRow(table, item) {
  if (table === 'tasks') return normalizeTask({ ...item, startTime: item.start_time, needsReview: item.needs_review });
  if (table === 'tests') return item;
  return normalizeNote({ ...item, taskId: item.task_id, needsReview: item.needs_review });
}

async function syncCollection(key, value) {
  const table = remoteTables[key];
  if (!table || !currentUser || !supabaseClient) return;
  const { error } = await supabaseClient.from(table).upsert(value.map((item) => toRemoteRow(table, item)), { onConflict: 'id' });
  if (error) console.error(`No se pudo sincronizar ${table}:`, error.message);
}

async function logUsage(eventName, metadata = {}) {
  if (!currentUser || !supabaseClient) return;
  const { error } = await supabaseClient.from('usage_events').insert({ user_id: currentUser.id, event_name: eventName, metadata });
  if (error) console.warn('No se pudo registrar actividad:', error.message);
}

async function loadRemoteData() {
  if (!currentUser || !supabaseClient) return;
  const results = await Promise.all(Object.entries(remoteTables).map(async ([key, table]) => {
    const { data, error } = await supabaseClient.from(table).select('*').order('date', { ascending: true });
    return { key, data, error };
  }));
  results.forEach(({ key, data, error }) => {
    if (error) {
      console.error(`No se pudo cargar ${remoteTables[key]}:`, error.message);
      return;
    }
    const table = remoteTables[key];
    const records = (data || []).map((item) => fromRemoteRow(table, item));
    if (records.length) {
      if (key === STORAGE_KEYS.tasks) state.tasks = records;
      if (key === STORAGE_KEYS.tests) state.tests = records;
      if (key === STORAGE_KEYS.notes) state.notes = records;
      localStorage.setItem(key, JSON.stringify(records));
    }
  });
}

async function loadCurrentProfile() {
  if (!currentUser || !supabaseClient) return;
  const { data, error } = await supabaseClient.from('profiles').select('display_name, role').eq('id', currentUser.id).maybeSingle();
  if (error) {
    console.warn('No se pudo cargar el perfil:', error.message);
    return;
  }
  currentProfile = data;
  const isAdmin = data?.role === 'admin';
  refs.adminButton.hidden = !isAdmin;
}

function openModal(panel) {
  if (panel) panel.hidden = false;
}

function closeModal(panel) {
  if (panel) panel.hidden = true;
}

async function loadAdminSummary() {
  if (!currentProfile || currentProfile.role !== 'admin' || !supabaseClient) return;
  const { data, error } = await supabaseClient.rpc('admin_list_users');
  if (error) {
    refs.adminMessage.textContent = `No se pudo cargar la administración: ${error.message}`;
    refs.adminMessage.classList.add('error');
    return;
  }
  const users = data || [];
  refs.adminUserCount.textContent = users.length;
  refs.adminActivityCount.textContent = users.reduce((sum, user) => sum + Number(user.activity_count || 0), 0);
  refs.adminUsersList.innerHTML = users.map((user) => `
    <tr data-admin-user-id="${user.id}">
      <td><strong>${user.display_name || 'Sin nombre'}</strong><small>${user.email || ''}</small></td>
      <td><select data-admin-field="role"><option value="user" ${user.role === 'user' ? 'selected' : ''}>Usuario</option><option value="admin" ${user.role === 'admin' ? 'selected' : ''}>Admin</option></select></td>
      <td><select data-admin-field="plan"><option value="free" ${user.plan === 'free' ? 'selected' : ''}>Free</option><option value="trial" ${user.plan === 'trial' ? 'selected' : ''}>Prueba</option><option value="paid" ${user.plan === 'paid' ? 'selected' : ''}>Pago</option></select></td>
      <td><select data-admin-field="status"><option value="active" ${user.status !== 'suspended' ? 'selected' : ''}>Activo</option><option value="suspended" ${user.status === 'suspended' ? 'selected' : ''}>Suspendido</option></select></td>
      <td>${user.activity_count || 0}</td>
      <td class="admin-actions"><button class="ghost-btn small" data-admin-action="save" type="button">Guardar</button><button class="ghost-btn small danger-btn" data-admin-action="delete" type="button">Eliminar</button></td>
    </tr>
  `).join('');
}

async function updateAdminUser(userId, row) {
  const role = row.querySelector('[data-admin-field="role"]').value;
  const plan = row.querySelector('[data-admin-field="plan"]').value;
  const status = row.querySelector('[data-admin-field="status"]').value;
  const { error } = await supabaseClient.rpc('admin_update_user', { target_user_id: userId, new_role: role, new_plan: plan, new_status: status });
  refs.adminMessage.textContent = error ? `No se pudo actualizar: ${error.message}` : 'Usuario actualizado correctamente.';
  refs.adminMessage.classList.toggle('error', Boolean(error));
  if (!error) await loadAdminSummary();
}

async function deleteAdminUser(userId, row) {
  const email = row.querySelector('small')?.textContent || 'este usuario';
  if (!window.confirm(`¿Eliminar definitivamente a ${email}?`)) return;
  const { error } = await supabaseClient.rpc('admin_delete_user', { target_user_id: userId });
  refs.adminMessage.textContent = error ? `No se pudo eliminar: ${error.message}` : 'Usuario eliminado correctamente.';
  refs.adminMessage.classList.toggle('error', Boolean(error));
  if (!error) await loadAdminSummary();
}

function setAuthMessage(message, isError = false) {
  refs.authMessage.textContent = message;
  refs.authMessage.classList.toggle('error', isError);
}

async function handleAuthSubmit(event) {
  event.preventDefault();
  const email = refs.authEmail.value.trim();
  const password = refs.authPassword.value;
  const method = refs.authForm.dataset.mode || 'login';
  refs.authSubmit.disabled = true;
  setAuthMessage('Conectando...');
  const result = method === 'signup'
    ? await supabaseClient.auth.signUp({ email, password })
    : await supabaseClient.auth.signInWithPassword({ email, password });
  refs.authSubmit.disabled = false;
  if (result.error) {
    setAuthMessage(result.error.message, true);
    return;
  }
  if (method === 'signup' && !result.data.session) {
    setAuthMessage('Cuenta creada. Revisa tu email para confirmar el acceso.');
    return;
  }
  await initializeAuthenticatedApp(result.data.session?.user || result.data.user);
}

async function initializeAuthenticatedApp(user) {
  currentUser = user;
  await loadCurrentProfile();
  logUsage('session_started');
  await loadRemoteData();
  refs.authPanel.hidden = true;
  document.querySelector('.app-shell').hidden = false;
  refs.userEmail.textContent = user.email || '';
  renderStats();
  renderCalendar();
  renderTestHistory();
  updateNoteTaskOptions();
  renderNotes();
  renderReviewSuggestions();
}

async function initializeAuth() {
  if (!supabaseClient) {
    refs.authPanel.hidden = false;
    setAuthMessage('No se pudo cargar Supabase. Comprueba tu conexión.', true);
    return;
  }
  const { data } = await supabaseClient.auth.getSession();
  if (data.session?.user) {
    await initializeAuthenticatedApp(data.session.user);
    return;
  }
  document.querySelector('.app-shell').hidden = true;
  refs.authPanel.hidden = false;
}

function resetTaskForm() {
  refs.taskForm.reset();
  state.editingTaskId = null;
  refs.taskFormSubmit.textContent = 'Guardar tarea';
  document.querySelector('#taskDuration').value = 45;
  document.querySelector('#taskTime').value = '09:00';
  document.querySelector('#taskStatus').value = 'planificado';
  document.querySelector('#taskDifficulty').value = 'media';
}

function openTaskForm(date = state.selectedDate) {
  refs.taskFormWrap.classList.add('visible');
  refs.taskForm.elements.date.value = date;
  refs.taskForm.elements.time.value = '09:00';
  refs.taskForm.elements.title.focus();
}

function normalizeTask(task) {
  return {
    ...task,
    date: task.date || task.dueDate || formatDate(new Date()),
    startTime: task.startTime || '09:00',
    status: task.status || (task.completed ? 'completado' : 'planificado'),
    completed: Boolean(task.completed),
    difficulty: task.difficulty || 'media',
    needsReview: Boolean(task.needsReview),
  };
}

function normalizeNote(note) {
  return {
    ...note,
    difficulty: note.difficulty || 'media',
    needsReview: note.needsReview !== undefined ? Boolean(note.needsReview) : true,
    topic: note.topic || 'General',
    date: note.date || note.createdAt || formatDate(new Date()),
  };
}

function fillTaskForm(task) {
  refs.taskFormWrap.classList.add('visible');
  state.editingTaskId = task.id;
  refs.taskForm.elements.title.value = task.title;
  refs.taskForm.elements.subject.value = task.subject;
  refs.taskForm.elements.duration.value = task.duration;
  refs.taskForm.elements.date.value = task.date || task.dueDate;
  refs.taskForm.elements.time.value = task.startTime || '09:00';
  refs.taskForm.elements.priority.value = task.priority || 'Media';
  refs.taskForm.elements.status.value = task.status || 'planificado';
  refs.taskForm.elements.difficulty.value = task.difficulty || 'media';
  refs.taskFormSubmit.textContent = 'Actualizar tarea';
}

function updateNoteTaskOptions() {
  const items = state.tasks
    .map((task) => `<option value="${task.id}">${task.subject} · ${task.title}</option>`)
    .join('');
  refs.noteTask.innerHTML = `<option value="">Sin tarea asociada</option>${items}`;
}

function renderStats() {
  const totalMinutes = state.tasks.reduce((sum, task) => sum + Number(task.duration || 0), 0);
  const doneCount = state.tasks.filter((task) => task.completed).length;
  const todayCount = state.tasks.filter((task) => task.date === formatDate(new Date())).length;

  refs.statTotal.textContent = String(state.tasks.length);
  refs.statDone.textContent = String(doneCount);
  refs.statMinutes.textContent = String(totalMinutes);
  refs.statToday.textContent = String(todayCount);

  const nextTask = [...state.tasks].find((task) => !task.completed) || state.tasks[0];
  refs.nextTask.textContent = nextTask ? nextTask.title : 'Sin tareas';
  refs.nextTaskMeta.textContent = nextTask ? `📚 ${nextTask.subject}` : '📚 Agenda';
  refs.nextTaskTime.textContent = nextTask ? `${nextTask.duration} min` : '0 min';

  const dates = getWeekDates(state.weekStart);
  refs.weekLabel.textContent = `Semana ${dates[0]} – ${dates[6]}`;
}

function renderCalendar() {
  const dates = getWeekDates(state.weekStart);
  const hours = Array.from({ length: 14 }, (_, index) => 8 * 60 + index * 60);

  const dayHeaders = ['<div class="time-label">Hora</div>', ...dates.map((date) => `
    <div class="day-header ${date === state.selectedDate ? 'selected-day' : ''}" data-date="${date}">
      <strong>${new Intl.DateTimeFormat('es-ES', { weekday: 'short' }).format(new Date(`${date}T00:00:00`))}</strong>
      <small>${new Intl.DateTimeFormat('es-ES', { day: 'numeric' }).format(new Date(`${date}T00:00:00`))}</small>
    </div>
  `)].join('');

  const columns = dates.map((date) => {
    const items = state.tasks
      .filter((task) => task.date === date)
      .map((task) => {
        const start = timeToMinutes(task.startTime || '09:00');
        const top = ((start - 8 * 60) / 60) * 68;
        const height = Math.max(((Number(task.duration) || 45) / 60) * 68, 44);
        const status = task.status || (task.completed ? 'completado' : 'planificado');
        const editActions = state.editMode ? `
              <span class="session-actions">
                <button class="session-action" type="button" data-action="edit" aria-label="Editar tarea">Editar</button>
                <button class="session-action danger" type="button" data-action="delete" aria-label="Eliminar tarea">Eliminar</button>
              </span>` : '';
        return `
          <div class="session-block ${state.editMode ? 'editable' : ''}" data-task-id="${task.id}" data-date="${date}" data-status="${status}" style="top:${top}px; height:${height}px;">
            <strong>${task.title}</strong>
            <small>${task.subject} · ${task.duration} min</small>
            ${editActions}
          </div>
        `;
      })
      .join('');

    const slots = Array.from({ length: 14 }, (_, index) => `<div class="hour-slot" data-date="${date}" data-hour="${8 + index}"></div>`).join('');

    return `
      <div class="day-column ${date === state.selectedDate ? 'selected' : ''}" data-date="${date}">
        ${slots}
        ${items}
      </div>
    `;
  }).join('');

  const timeLabels = hours.map((minutes) => `<div class="time-label">${minutesToTime(minutes)}</div>`).join('');
  const emptyCalendar = state.tasks.length ? '' : '<div class="calendar-empty">Importa tu planificación o crea una nueva tarea para empezar.</div>';
  refs.calendarGrid.innerHTML = `${emptyCalendar}<div class="calendar-head">${dayHeaders}</div><div class="calendar-row"><div class="time-column">${timeLabels}</div>${columns}</div>`;
  renderDayDetail();
}

function renderDayDetail() {
  const tasks = state.tasks
    .filter((task) => task.date === state.selectedDate)
    .sort((a, b) => timeToMinutes(a.startTime || '09:00') - timeToMinutes(b.startTime || '09:00'));

  refs.dayDetailHeader.textContent = `${formatDisplayDate(state.selectedDate)} · ${tasks.length} bloques`;

  if (!tasks.length) {
    refs.dayDetailList.innerHTML = '<li class="empty-state">No hay tareas para este día.</li>';
    return;
  }

  refs.dayDetailList.innerHTML = tasks.map((task) => `
    <li class="day-detail-item">
      <strong>${task.title}</strong>
      <small>${task.subject} · ${task.startTime} · ${task.duration} min · ${task.priority}</small>
    </li>
  `).join('');
}

function getReviewTone(score) {
  if (score >= 4) return { label: 'Rojo', className: 'risk-high' };
  if (score >= 2) return { label: 'Amarillo', className: 'risk-medium' };
  return { label: 'Verde', className: 'risk-low' };
}

function calculateNoteRisk(note) {
  const sameTopicNotes = state.notes.filter((item) => item.subject === note.subject && item.topic === note.topic).length;
  const sameSubjectTests = state.tests.filter((item) => item.subject === note.subject);
  const testFailures = sameSubjectTests.reduce((sum, item) => sum + Number(item.incorrect || 0), 0);
  const testTotal = sameSubjectTests.reduce((sum, item) => sum + Number(item.correct || 0) + Number(item.incorrect || 0), 0);
  const failureRatio = testTotal ? testFailures / testTotal : 0;
  const difficultyBoost = note.difficulty === 'alta' ? 2 : note.difficulty === 'media' ? 1 : 0;
  const reviewBoost = note.needsReview ? 1 : 0;

  const score = sameTopicNotes + (failureRatio > 0.28 ? 2 : failureRatio > 0.15 ? 1 : 0) + difficultyBoost + reviewBoost;
  return { score, tone: getReviewTone(score) };
}

function buildReviewSuggestions() {
  const bySubject = new Map();

  state.notes.forEach((note) => {
    const key = `${note.subject}|${note.topic}`;
    if (!bySubject.has(key)) {
      bySubject.set(key, { subject: note.subject, topic: note.topic, count: 0, totalDifficulty: 0, needsReview: 0 });
    }
    const item = bySubject.get(key);
    item.count += 1;
    item.totalDifficulty += note.difficulty === 'alta' ? 3 : note.difficulty === 'media' ? 2 : 1;
    item.needsReview += note.needsReview ? 1 : 0;
  });

  state.tests.forEach((test) => {
    const key = test.subject;
    if (!bySubject.has(key)) {
      bySubject.set(key, { subject: test.subject, topic: 'Test', count: 0, totalDifficulty: 0, needsReview: 0 });
    }
    const item = bySubject.get(key);
    item.count += Number(test.incorrect || 0);
  });

  const suggestions = [...bySubject.values()]
    .map((item) => {
      const score = item.count + Math.ceil(item.totalDifficulty / 2) + item.needsReview;
      const tone = getReviewTone(score);
      const recommendedMinutes = score >= 6 ? 50 : score >= 3 ? 30 : 20;
      return {
        subject: item.subject,
        topic: item.topic,
        score,
        tone,
        recommendedMinutes,
      };
    })
    .sort((a, b) => b.score - a.score)
    .slice(0, 4);

  if (!refs.reviewSuggestions) return;

  if (!suggestions.length) {
    refs.reviewSuggestions.innerHTML = '<div class="review-empty">Nada que repasar todavía.</div>';
    return;
  }

  refs.reviewSuggestions.innerHTML = suggestions.map((item) => `
    <div class="review-item ${item.tone.className}">
      <div class="review-title-row">
        <strong>${item.subject}</strong>
        <span class="risk-badge ${item.tone.className}">${item.tone.label}</span>
      </div>
      <div class="review-topic">${item.topic}</div>
      <div class="review-meta">Recomendación: ${item.recommendedMinutes} min de repaso</div>
    </div>
  `).join('');
}

function renderNotes() {
  const query = (refs.noteSearch?.value || '').trim().toLowerCase();
  const visible = state.notes.filter((note) => {
    if (!query) return true;
    const haystack = `${note.subject} ${note.topic || ''} ${note.text} ${note.date || ''}`.toLowerCase();
    return haystack.includes(query);
  });

  if (!visible.length) {
    refs.notesList.innerHTML = '<li class="empty-state">No hay errores que coincidan con la búsqueda.</li>';
    return;
  }

  refs.notesList.innerHTML = visible.slice().reverse().map((note) => {
    const task = state.tasks.find((item) => item.id === note.taskId);
    const risk = calculateNoteRisk(note);
    return `
      <li class="history-item">
        <div class="note-header">
          <strong>${note.subject}</strong>
          <span>${note.date || note.createdAt}</span>
        </div>
        <div class="note-topic-row">
          <span class="note-topic">Tema: ${note.topic || 'General'}</span>
          <span class="risk-badge ${risk.tone.className}">${risk.tone.label}</span>
        </div>
        <div class="note-text">${note.text}</div>
        <div class="note-meta">
          <small>${task ? `Tarea: ${task.title}` : 'Sin tarea asociada'}</small>
          <small>${note.difficulty ? `Dificultad: ${note.difficulty}` : 'Dificultad: media'}</small>
        </div>
      </li>
    `;
  }).join('');
}

function renderReviewSuggestions() {
  const map = new Map();

  state.notes.forEach((note) => {
    const key = `${note.subject}|${note.topic}`;
    if (!map.has(key)) {
      map.set(key, { subject: note.subject, topic: note.topic, count: 0, weight: 0, needsReview: 0 });
    }
    const item = map.get(key);
    item.count += 1;
    item.weight += note.difficulty === 'alta' ? 3 : note.difficulty === 'media' ? 2 : 1;
    item.needsReview += note.needsReview ? 1 : 0;
  });

  state.tests.forEach((test) => {
    const key = test.subject;
    if (!map.has(key)) {
      map.set(key, { subject: test.subject, topic: 'Resultado de test', count: 0, weight: 0, needsReview: 0 });
    }
    const item = map.get(key);
    item.count += Number(test.incorrect || 0);
    item.weight += Number(test.incorrect || 0) * 2;
  });

  const suggestions = [...map.values()]
    .map((item) => {
      const score = item.count + Math.ceil(item.weight / 2) + item.needsReview;
      const tone = getReviewTone(score);
      return {
        subject: item.subject,
        topic: item.topic,
        score,
        tone,
        recommendedMinutes: score >= 6 ? 50 : score >= 3 ? 30 : 20,
      };
    })
    .sort((a, b) => b.score - a.score)
    .slice(0, 4);

  if (!refs.reviewSuggestions) return;

  if (!suggestions.length) {
    refs.reviewSuggestions.innerHTML = '<div class="review-empty">Nada que repasar todavía.</div>';
    return;
  }

  refs.reviewSuggestions.innerHTML = suggestions.map((item) => `
    <div class="review-item ${item.tone.className}">
      <div class="review-title-row">
        <strong>${item.subject}</strong>
        <span class="risk-badge ${item.tone.className}">${item.tone.label}</span>
      </div>
      <div class="review-topic">${item.topic}</div>
      <div class="review-meta">Recomendación: ${item.recommendedMinutes} min de repaso</div>
    </div>
  `).join('');
}

function renderTestHistory() {
  const totalCorrect = state.tests.reduce((sum, test) => sum + Number(test.correct || 0), 0);
  const totalIncorrect = state.tests.reduce((sum, test) => sum + Number(test.incorrect || 0), 0);
  const total = totalCorrect + totalIncorrect;
  const accuracy = total ? Math.round((totalCorrect / total) * 100) : 0;

  if (refs.accuracyMetric) refs.accuracyMetric.textContent = `${accuracy}%`;
  if (refs.failuresMetric) refs.failuresMetric.textContent = String(totalIncorrect);
  if (!refs.testHistoryList) return;

  if (!state.tests.length) {
    refs.testHistoryList.innerHTML = '<li class="empty-state">Todavía no hay resultados de test.</li>';
    return;
  }

  refs.testHistoryList.innerHTML = state.tests.slice().reverse().map((test) => `
    <li class="history-item">
      <strong>${test.subject}</strong>
      <div>✅ ${test.correct} aciertos · ❌ ${test.incorrect} fallos</div>
      <small>${test.date}</small>
    </li>
  `).join('');
}

function setLoadedPlanLabel(fileName) {
  refs.loadedPlanLabel.textContent = fileName ? `Plan activo: ${fileName}` : 'Sin archivo de planificación cargado';
}

async function readTextFromFile(file) {
  const extension = file.name.split('.').pop()?.toLowerCase();
  if (extension === 'md' || extension === 'txt') return file.text();
  if (extension === 'docx') {
    const buffer = await file.arrayBuffer();
    const result = await mammoth.extractRawText({ arrayBuffer: buffer });
    return result.value || '';
  }
  if (extension === 'pdf') {
    const buffer = await file.arrayBuffer();
    const pdf = await pdfjsLib.getDocument({ data: buffer }).promise;
    let text = '';
    for (let i = 1; i <= pdf.numPages; i += 1) {
      const page = await pdf.getPage(i);
      const content = await page.getTextContent();
      text += `${content.items.map((item) => item.str).join(' ')}\n`;
    }
    return text;
  }
  return file.text();
}

function cleanMarkdownCell(value) {
  return String(value || '')
    .replace(/<br\s*\/?>(\s*)/gi, ' ')
    .replace(/\*\*(.*?)\*\*/g, '$1')
    .replace(/\*(.*?)\*/g, '$1')
    .replace(/\\([|()])/g, '$1')
    .replace(/\s+/g, ' ')
    .trim();
}

function parseScheduleDate(value, startYear = 2026, startMonth = 8) {
  const months = {
    ene: 0, enero: 0, feb: 1, febrero: 1, mar: 2, marzo: 2,
    abr: 3, abril: 3, may: 4, mayo: 4, jun: 5, junio: 5,
    jul: 6, julio: 6, ago: 7, agosto: 7, sep: 8, sept: 8, septiembre: 8,
    oct: 9, octubre: 9, nov: 10, noviembre: 10, dic: 11, diciembre: 11,
  };
  const match = cleanMarkdownCell(value).toLowerCase().match(/(\d{1,2})\s+([a-záéíóú]+)/i);
  if (!match) return '';
  const monthKey = match[2].normalize('NFD').replace(/[\u0300-\u036f]/g, '');
  const month = months[monthKey];
  if (month === undefined) return '';
  const year = month < startMonth ? startYear + 1 : startYear;
  return formatDate(new Date(year, month, Number(match[1])));
}

function parseScheduleMarkdown(markdown) {
  const tasks = [];
  const blockDefinitions = [
    { label: 'Teoría', duration: 210, startTime: '08:00' },
    { label: 'Test', duration: 90, startTime: '11:30' },
    { label: 'Supuestos', duration: 90, startTime: '13:00' },
    { label: 'Repaso', duration: 90, startTime: '14:30' },
  ];

  markdown.split(/\r?\n/).forEach((line) => {
    const trimmed = line.trim();
    if (!trimmed.startsWith('|') || !trimmed.endsWith('|') || /^\|\s*:?-+/.test(trimmed)) return;
    const cells = trimmed.slice(1, -1).split('|').map(cleanMarkdownCell);
    if (cells.length < 5 || !/\d{1,2}\s+[A-Za-zÁÉÍÓÚáéíóú]+/.test(cells[0])) return;

    const date = parseScheduleDate(cells[0]);
    if (!date) return;
    blockDefinitions.forEach((definition, index) => {
      const title = cells[index + 1];
      if (!title) return;
      const lowerTitle = title.toLowerCase();
      const isRest = lowerTitle.includes('descanso') || lowerTitle.includes('festivo');
      tasks.push(normalizeTask({
        id: `task-${Date.now()}-${Math.random().toString(16).slice(2, 8)}`,
        title,
        subject: definition.label,
        duration: isRest ? 0 : definition.duration,
        date,
        startTime: definition.startTime,
        priority: /simulacro|evaluación|examen|clase academia/i.test(title) ? 'Alta' : 'Media',
        status: 'planificado',
        completed: false,
        difficulty: /simulacro|examen|supuesto/i.test(title) ? 'alta' : 'media',
      }));
    });
  });

  return tasks;
}

function parseMarkdownPlan(markdown) {
  const scheduleTasks = parseScheduleMarkdown(markdown);
  if (scheduleTasks.length) return scheduleTasks;

  const lines = markdown.split(/\r?\n/).map((line) => line.trim()).filter(Boolean);
  const tasks = [];

  lines.forEach((line) => {
    let cleaned = line.replace(/^[-*]\s*/, '').replace(/^\d+\.\s*/, '');
    const doneMatch = cleaned.match(/^\[(x|X|\s)\]\s*(.*)$/);
    const completed = Boolean(doneMatch && /x|X/.test(doneMatch[1]));
    if (doneMatch) cleaned = doneMatch[2].trim();
    if (!cleaned) return;

    let task = null;
    if (cleaned.includes('|')) {
      const parts = cleaned.split('|').map((part) => part.trim());
      if (parts.length >= 6) {
        task = {
          id: `task-${Date.now()}-${Math.random().toString(16).slice(2, 8)}`,
          title: parts[0],
          subject: parts[1],
          duration: Number(parts[2]) || 45,
          date: parts[3] || formatDate(new Date()),
          startTime: parts[4] || '09:00',
          priority: parts[5] || 'Media',
          status: completed ? 'completado' : 'planificado',
          completed,
        };
      }
    } else {
      const parts = cleaned.split(/\s*[-–—]\s*/).map((part) => part.trim()).filter(Boolean);
      if (parts.length >= 6) {
        task = {
          id: `task-${Date.now()}-${Math.random().toString(16).slice(2, 8)}`,
          title: parts[0],
          subject: parts[1],
          duration: Number(parts[2]) || 45,
          date: parts[3] || formatDate(new Date()),
          startTime: parts[4] || '09:00',
          priority: parts[5] || 'Media',
          status: completed ? 'completado' : 'planificado',
          completed,
        };
      }
    }

    if (task && task.title && task.subject) tasks.push(normalizeTask(task));
  });

  return tasks;
}

function importPlanFromMarkdown(markdown, sourceName = '') {
  const parsed = parseMarkdownPlan(markdown);
  if (!parsed.length) {
    alert('No se encontraron tareas válidas. Usa líneas como: - [ ] Matemáticas | Álgebra | 45 | 2026-09-15 | 09:00 | Alta');
    return;
  }

  const existing = new Set(state.tasks.map((task) => `${task.title}|${task.subject}|${task.date}`));
  const toAdd = parsed.filter((task) => !existing.has(`${task.title}|${task.subject}|${task.date}`));

  state.tasks = [...state.tasks, ...toAdd];
  logUsage('plan_imported', { source: sourceName || 'pasted', task_count: toAdd.length });
  saveData(STORAGE_KEYS.tasks, state.tasks);
  if (toAdd.length) {
    state.selectedDate = toAdd[0].date;
    state.weekStart = getStartOfWeek(new Date(`${toAdd[0].date}T00:00:00`));
  }
  renderStats();
  renderCalendar();
  updateNoteTaskOptions();
  if (sourceName) setLoadedPlanLabel(sourceName);
  refs.planMarkdown.value = '';
  refs.planFileInput.value = '';
}

function exportBackup() {
  const backup = { exportedAt: new Date().toISOString(), tasks: state.tasks, tests: state.tests, notes: state.notes };
  const blob = new Blob([JSON.stringify(backup, null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = 'studyflow-backup.json';
  a.click();
  URL.revokeObjectURL(url);
}

function restoreBackup(file) {
  const reader = new FileReader();
  reader.onload = (event) => {
    try {
      const data = JSON.parse(String(event.target?.result || ''));
      if (!data || !Array.isArray(data.tasks)) throw new Error('Formato inválido');
      state.tasks = data.tasks.map(normalizeTask);
      state.tests = Array.isArray(data.tests) ? data.tests : [];
      state.notes = Array.isArray(data.notes) ? data.notes : [];
      saveData(STORAGE_KEYS.tasks, state.tasks);
      saveData(STORAGE_KEYS.tests, state.tests);
      saveData(STORAGE_KEYS.notes, state.notes);
      renderStats();
      renderCalendar();
      renderTestHistory();
      renderNotes();
      updateNoteTaskOptions();
      alert('Copia restaurada correctamente.');
    } catch (error) {
      alert('El archivo de respaldo no es válido.');
    }
  };
  reader.readAsText(file);
}

function renderTimer() {
  const minutes = Math.floor(state.timerSeconds / 60);
  const seconds = state.timerSeconds % 60;
  if (refs.timerDisplay) refs.timerDisplay.textContent = `${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`;
  if (refs.startTimer) refs.startTimer.textContent = state.isRunning ? 'Pausar' : 'Iniciar';
  if (refs.customTimerMinutes) refs.customTimerMinutes.value = String(state.selectedMinutes);
}

function updateTimerTo(minutes) {
  const clamped = Math.max(5, Math.min(180, Number(minutes) || 25));
  state.selectedMinutes = clamped;
  state.timerSeconds = clamped * 60;
  state.isRunning = false;
  if (state.timerInterval) clearInterval(state.timerInterval);
  refs.timerButtons.forEach((button) => button.classList.toggle('active', Number(button.dataset.minutes) === clamped));
  renderTimer();
}

function startTimer() {
  if (state.isRunning) {
    state.isRunning = false;
    clearInterval(state.timerInterval);
    state.timerInterval = null;
    renderTimer();
    return;
  }

  state.isRunning = true;
  state.timerInterval = setInterval(() => {
    if (state.timerSeconds <= 0) {
      clearInterval(state.timerInterval);
      state.timerInterval = null;
      state.isRunning = false;
      alert('¡Tiempo terminado!');
      renderTimer();
      return;
    }
    state.timerSeconds -= 1;
    renderTimer();
  }, 1000);
  renderTimer();
}

function resetTimer() {
  state.isRunning = false;
  if (state.timerInterval) clearInterval(state.timerInterval);
  state.timerSeconds = state.selectedMinutes * 60;
  renderTimer();
}

refs.addTaskButton.addEventListener('click', () => {
  if (!refs.taskFormWrap.classList.contains('visible')) openTaskForm();
  else refs.taskFormWrap.classList.remove('visible');
  if (!refs.taskFormWrap.classList.contains('visible')) resetTaskForm();
});

refs.editCalendarButton.addEventListener('click', () => {
  state.editMode = !state.editMode;
  refs.editCalendarButton.textContent = state.editMode ? 'Terminar edición' : 'Editar calendario';
  refs.editCalendarButton.classList.toggle('active', state.editMode);
  renderCalendar();
});

refs.taskForm.addEventListener('submit', (event) => {
  event.preventDefault();
  const formData = new FormData(event.currentTarget);
  const taskData = {
    title: String(formData.get('title')).trim(),
    subject: String(formData.get('subject')).trim(),
    duration: Number(formData.get('duration')) || 45,
    date: String(formData.get('date')) || formatDate(new Date()),
    startTime: String(formData.get('time')) || '09:00',
    priority: String(formData.get('priority')) || 'Media',
    status: String(formData.get('status')) || 'planificado',
    difficulty: String(formData.get('difficulty')) || 'media',
    needsReview: String(formData.get('difficulty')) === 'alta',
  };

  if (!taskData.title || !taskData.subject || !taskData.date) return;

  if (state.editingTaskId) {
    state.tasks = state.tasks.map((task) => task.id === state.editingTaskId ? { ...task, ...taskData, completed: taskData.status === 'completado' } : task);
  } else {
    state.tasks.push({ id: `task-${Date.now()}`, ...taskData, completed: taskData.status === 'completado' });
  }

  saveData(STORAGE_KEYS.tasks, state.tasks.map(normalizeTask));
  renderStats();
  renderCalendar();
  updateNoteTaskOptions();
  resetTaskForm();
  refs.taskFormWrap.classList.remove('visible');
});

refs.calendarGrid.addEventListener('click', (event) => {
  const action = event.target.closest('[data-action]');
  const block = event.target.closest('[data-task-id]');
  if (action && block) {
    event.stopPropagation();
    const task = state.tasks.find((item) => item.id === block.dataset.taskId);
    if (!task) return;
    if (action.dataset.action === 'delete') {
      if (!window.confirm(`¿Eliminar "${task.title}"?`)) return;
      state.tasks = state.tasks.filter((item) => item.id !== task.id);
      saveData(STORAGE_KEYS.tasks, state.tasks);
      if (currentUser && supabaseClient) supabaseClient.from('tasks').delete().eq('id', task.id).eq('user_id', currentUser.id);
      renderStats();
      renderCalendar();
      updateNoteTaskOptions();
      return;
    }
    fillTaskForm(task);
    return;
  }
  const target = event.target.closest('[data-date]');
  if (!target) return;
  state.selectedDate = target.dataset.date;
  renderCalendar();
});

refs.prevWeek.addEventListener('click', () => {
  state.weekStart = new Date(state.weekStart);
  state.weekStart.setDate(state.weekStart.getDate() - 7);
  renderStats();
  renderCalendar();
});

refs.nextWeek.addEventListener('click', () => {
  state.weekStart = new Date(state.weekStart);
  state.weekStart.setDate(state.weekStart.getDate() + 7);
  renderStats();
  renderCalendar();
});

refs.navButtons.forEach((button) => {
  button.addEventListener('click', () => {
    refs.navButtons.forEach((item) => item.classList.toggle('active', item === button));
    state.filter = button.dataset.filter;
    const visibleTasks = state.tasks.filter((task) => {
      if (state.filter === 'today') return task.date === formatDate(new Date());
      if (state.filter === 'upcoming') return task.date >= formatDate(new Date()) && !task.completed;
      if (state.filter === 'done') return task.completed;
      return true;
    });
    if (visibleTasks.length) {
      state.selectedDate = visibleTasks[0].date;
    }
    renderCalendar();
  });
});

refs.choosePlanFile.addEventListener('click', () => refs.planFileInput.click());
refs.planFileInput.addEventListener('change', async (event) => {
  const [file] = event.target.files;
  if (!file) return;
  try {
    const content = await readTextFromFile(file);
    refs.planMarkdown.value = content;
    setLoadedPlanLabel(file.name);
    importPlanFromMarkdown(content, file.name);
  } catch (error) {
    console.error(error);
    alert('No se pudo leer ese fichero.');
  }
});

refs.loadExamplePlan.addEventListener('click', () => {
  const example = `# Plan\n- [ ] Matemáticas | Álgebra | 45 | ${formatDate(new Date())} | 09:00 | Alta\n- [ ] Historia | Revolución | 60 | ${addDays(new Date(), 1)} | 17:30 | Media\n- [x] Química | Enlaces | 75 | ${addDays(new Date(), 2)} | 10:30 | Alta`;
  refs.planMarkdown.value = example;
  setLoadedPlanLabel('ejemplo-plan.md');
});

refs.importPlanButton.addEventListener('click', () => {
  const label = refs.loadedPlanLabel.textContent;
  importPlanFromMarkdown(refs.planMarkdown.value, label === 'Sin archivo de planificación cargado' ? '' : label.replace('Plan activo: ', ''));
});

refs.exportBackupButton.addEventListener('click', exportBackup);
refs.restoreBackupButton.addEventListener('click', () => refs.backupFileInput.click());
refs.backupFileInput.addEventListener('change', (event) => {
  const [file] = event.target.files;
  if (file) {
    restoreBackup(file);
    refs.backupFileInput.value = '';
  }
});

if (refs.testForm) {
  refs.testForm.addEventListener('submit', (event) => {
    event.preventDefault();
    const formData = new FormData(event.currentTarget);
    const subject = String(formData.get('subject')).trim();
    const date = String(formData.get('date')) || formatDate(new Date());
    const correct = Number(formData.get('correct')) || 0;
    const incorrect = Number(formData.get('incorrect')) || 0;
    if (!subject) return;
    state.tests.push({ id: `test-${Date.now()}`, subject, date, correct, incorrect });
    saveData(STORAGE_KEYS.tests, state.tests);
    renderTestHistory();
    renderReviewSuggestions();
    refs.testForm.reset();
  });
}

if (refs.noteForm) {
  refs.noteForm.addEventListener('submit', (event) => {
    event.preventDefault();
    const formData = new FormData(event.currentTarget);
    const subject = String(formData.get('subject')).trim();
    const topic = String(formData.get('topic')).trim();
    const text = String(formData.get('text')).trim();
    const date = String(formData.get('date')) || formatDate(new Date());
    const taskId = String(formData.get('taskId') || '');
    const difficulty = String(formData.get('difficulty') || 'media');
    const needsReview = Boolean(formData.get('needsReview'));
    if (!subject || !topic || !text) return;
    state.notes.push({ id: `note-${Date.now()}`, subject, topic, taskId, text, createdAt: formatDate(new Date()), date, difficulty, needsReview });
    saveData(STORAGE_KEYS.notes, state.notes.map(normalizeNote));
    renderNotes();
    renderReviewSuggestions();
    refs.noteForm.reset();
    refs.noteTask.value = '';
  });
}

if (refs.noteSearch) refs.noteSearch.addEventListener('input', renderNotes);

refs.timerButtons.forEach((button) => button.addEventListener('click', () => updateTimerTo(Number(button.dataset.minutes))));
if (refs.applyCustomTimer) {
  refs.applyCustomTimer.addEventListener('click', () => {
    const value = Number(refs.customTimerMinutes?.value || 25);
    updateTimerTo(Math.max(5, Math.min(180, value || 25)));
  });
}
if (refs.customTimerMinutes) {
  refs.customTimerMinutes.addEventListener('change', () => {
    const value = Number(refs.customTimerMinutes.value || 25);
    updateTimerTo(Math.max(5, Math.min(180, value || 25)));
  });
}
if (refs.startTimer) refs.startTimer.addEventListener('click', startTimer);
if (refs.resetTimer) refs.resetTimer.addEventListener('click', resetTimer);

if (refs.authForm) {
  refs.authForm.dataset.mode = 'login';
  refs.authForm.addEventListener('submit', handleAuthSubmit);
}
if (refs.authToggle) {
  refs.authToggle.addEventListener('click', () => {
    const isSignup = refs.authForm.dataset.mode !== 'signup';
    refs.authForm.dataset.mode = isSignup ? 'signup' : 'login';
    refs.authSubmit.textContent = isSignup ? 'Crear cuenta' : 'Iniciar sesión';
    refs.authToggle.textContent = isSignup ? 'Ya tengo una cuenta' : 'Crear cuenta';
    setAuthMessage('');
  });
}
async function signOut() {
  if (!supabaseClient) return;
  await supabaseClient.auth.signOut();
  window.location.reload();
}

if (refs.signOutButton && supabaseClient) {
  refs.signOutButton.addEventListener('click', signOut);
}
if (refs.signOutSidebarButton && supabaseClient) {
  refs.signOutSidebarButton.addEventListener('click', signOut);
}

if (refs.manualButton) refs.manualButton.addEventListener('click', () => openModal(refs.manualPanel));
if (refs.adminButton) refs.adminButton.addEventListener('click', async () => {
  openModal(refs.adminPanel);
  await loadAdminSummary();
});
if (refs.refreshAdminButton) refs.refreshAdminButton.addEventListener('click', loadAdminSummary);
if (refs.adminUsersList) refs.adminUsersList.addEventListener('click', async (event) => {
  const action = event.target.closest('[data-admin-action]');
  const row = event.target.closest('[data-admin-user-id]');
  if (!action || !row) return;
  if (action.dataset.adminAction === 'save') await updateAdminUser(row.dataset.adminUserId, row);
  if (action.dataset.adminAction === 'delete') await deleteAdminUser(row.dataset.adminUserId, row);
});
document.querySelectorAll('[data-close-modal]').forEach((button) => {
  button.addEventListener('click', () => closeModal(document.querySelector(`#${button.dataset.closeModal}`)));
});
document.querySelectorAll('.modal-panel').forEach((panel) => {
  panel.addEventListener('click', (event) => {
    if (event.target === panel) closeModal(panel);
  });
});

updateTimerTo(25);
renderStats();
renderCalendar();
renderTestHistory();
updateNoteTaskOptions();
renderNotes();
renderReviewSuggestions();
initializeAuth();

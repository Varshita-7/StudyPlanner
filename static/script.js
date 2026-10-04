// =========================================================
// GLOBAL DATA
// =========================================================

let subjects = [];
let tasks = [];
let schedule = [];
let currentUser = null;


// =========================================================
// API HELPER
// =========================================================

async function api(url, options = {}) {

    try {

        const response = await fetch(url, {
            headers: {
                "Content-Type": "application/json",
                ...(options.headers || {})
            },
            ...options
        });

        let data = {};

        try {
            data = await response.json();
        } catch {
            data = {};
        }

        if (response.status === 401) {
            window.location.href = "/";
            return null;
        }

        if (!response.ok) {

            throw new Error(
                data.message || "Something went wrong."
            );
        }

        return data;

    } catch (error) {

        console.error(error);

        showToast(
            error.message || "Something went wrong.",
            "error"
        );

        throw error;
    }
}


// =========================================================
// PAGE LOAD
// =========================================================

document.addEventListener("DOMContentLoaded", () => {

    setupAuth();

    const dashboard = document.querySelector(".app-body");

    if (dashboard) {
        initializeDashboard();
    }

});


// =========================================================
// AUTH
// =========================================================

function setupAuth() {

    const loginForm = document.getElementById("loginForm");

    const signupForm = document.getElementById("signupForm");


    if (loginForm) {

        loginForm.addEventListener(
            "submit",
            async function (event) {

                event.preventDefault();

                const email =
                    document.getElementById("loginEmail").value.trim();

                const password =
                    document.getElementById("loginPassword").value;


                if (!email || !password) {

                    showAuthMessage(
                        "Please enter email and password.",
                        "error"
                    );

                    return;
                }


                const button =
                    loginForm.querySelector("button[type='submit']");

                button.disabled = true;
                button.textContent = "Signing in...";


                try {

                    const result = await api(
                        "/login",
                        {
                            method: "POST",

                            body: JSON.stringify({
                                email,
                                password
                            })
                        }
                    );


                    if (result && result.success) {

                        showAuthMessage(
                            result.message,
                            "success"
                        );

                        window.location.href =
                            result.redirect || "/dashboard";
                    }

                } catch (error) {

                    // api() already displays the error

                } finally {

                    button.disabled = false;
                    button.textContent = "Sign In";
                }

            }
        );

    }


    if (signupForm) {

        signupForm.addEventListener(
            "submit",
            async function (event) {

                event.preventDefault();


                const name =
                    document.getElementById("signupName").value.trim();

                const email =
                    document.getElementById("signupEmail").value.trim();

                const password =
                    document.getElementById("signupPassword").value;


                if (!name || !email || !password) {

                    showAuthMessage(
                        "Please fill all fields.",
                        "error"
                    );

                    return;
                }


                if (password.length < 6) {

                    showAuthMessage(
                        "Password must contain at least 6 characters.",
                        "error"
                    );

                    return;
                }


                const button =
                    signupForm.querySelector("button[type='submit']");

                button.disabled = true;
                button.textContent = "Creating...";


                try {

                    const result = await api(
                        "/register",
                        {
                            method: "POST",

                            body: JSON.stringify({
                                name,
                                email,
                                password
                            })
                        }
                    );


                    if (result && result.success) {

                        showAuthMessage(
                            result.message,
                            "success"
                        );

                        window.location.href =
                            result.redirect || "/dashboard";
                    }

                } catch (error) {

                    // api() already handles it

                } finally {

                    button.disabled = false;
                    button.textContent = "Create Account";
                }

            }
        );

    }

}


// =========================================================
// LOGIN / SIGNUP SWITCH
// =========================================================

function showSignup() {

    const loginCard =
        document.getElementById("loginCard");

    const signupCard =
        document.getElementById("signupCard");

    if (loginCard) {
        loginCard.classList.add("hidden");
    }

    if (signupCard) {
        signupCard.classList.remove("hidden");
    }

    clearAuthMessage();
}


function showLogin() {

    const loginCard =
        document.getElementById("loginCard");

    const signupCard =
        document.getElementById("signupCard");

    if (signupCard) {
        signupCard.classList.add("hidden");
    }

    if (loginCard) {
        loginCard.classList.remove("hidden");
    }

    clearAuthMessage();
}


function showAuthMessage(message, type = "error") {

    const element =
        document.getElementById("authMessage");

    if (!element) return;

    element.textContent = message;

    element.className =
        "auth-message " + type;
}


function clearAuthMessage() {

    const element =
        document.getElementById("authMessage");

    if (!element) return;

    element.textContent = "";
    element.className = "auth-message";
}


// =========================================================
// DASHBOARD INITIALIZATION
// =========================================================

async function initializeDashboard() {

    setupNavigation();

    setupForms();

    setupModalEvents();

    setDate();

    await loadAllData();

}


// =========================================================
// LOAD ALL DATA
// =========================================================

async function loadAllData() {

    try {

        const userResult = await api("/api/user");

        if (!userResult) return;

        currentUser = userResult.user;

        displayUser();


        const subjectResult =
            await api("/api/subjects");

        if (subjectResult) {
            subjects = subjectResult.subjects || [];
        }


        const taskResult =
            await api("/api/tasks");

        if (taskResult) {
            tasks = taskResult.tasks || [];
        }


        const scheduleResult =
            await api("/api/schedule");

        if (scheduleResult) {
            schedule = scheduleResult.schedule || [];
        }


        renderEverything();

    } catch (error) {

        console.error(
            "Unable to load dashboard:",
            error
        );
    }

}


// =========================================================
// DISPLAY USER
// =========================================================

function displayUser() {

    if (!currentUser) return;


    const name =
        currentUser.name || "User";

    const email =
        currentUser.email || "";


    const profileName =
        document.getElementById("profileName");

    const profileEmail =
        document.getElementById("profileEmail");

    const profileAvatar =
        document.getElementById("profileAvatar");

    const welcomeName =
        document.getElementById("welcomeName");

    const settingsName =
        document.getElementById("settingsName");

    const settingsEmail =
        document.getElementById("settingsEmail");


    if (profileName) {
        profileName.textContent = name;
    }

    if (profileEmail) {
        profileEmail.textContent = email;
    }

    if (welcomeName) {
        welcomeName.textContent =
            name.split(" ")[0];
    }

    if (settingsName) {
        settingsName.value = name;
    }

    if (settingsEmail) {
        settingsEmail.value = email;
    }


    if (profileAvatar) {

        profileAvatar.textContent =
            name.charAt(0).toUpperCase();
    }

}


// =========================================================
// DATE
// =========================================================

function setDate() {

    const dateElement =
        document.getElementById("todayDate");

    if (!dateElement) return;


    const today = new Date();


    dateElement.textContent =
        today.toLocaleDateString(
            "en-IN",
            {
                weekday: "short",
                day: "numeric",
                month: "short",
                year: "numeric"
            }
        );
}


// =========================================================
// NAVIGATION
// =========================================================

function setupNavigation() {

    const buttons =
        document.querySelectorAll(".nav-btn");


    buttons.forEach(button => {

        button.addEventListener(
            "click",
            () => {

                const page =
                    button.dataset.page;

                openPage(page);

            }
        );

    });


    const logout =
        document.getElementById("logoutBtn");


    if (logout) {

        logout.addEventListener(
            "click",
            async () => {

                window.location.href =
                    "/logout";

            }
        );

    }

}


function openPage(page) {

    document
        .querySelectorAll(".page-section")
        .forEach(section => {

            section.classList.remove("active");

        });


    document
        .querySelectorAll(".nav-btn")
        .forEach(button => {

            button.classList.remove("active");

        });


    const target =
        document.getElementById(
            page + "Page"
        );


    const navButton =
        document.querySelector(
            `.nav-btn[data-page="${page}"]`
        );


    if (target) {
        target.classList.add("active");
    }


    if (navButton) {
        navButton.classList.add("active");
    }


    const titles = {

        dashboard: [
            "Dashboard",
            "Here's your study overview."
        ],

        subjects: [
            "Subjects",
            "Manage the subjects you are studying."
        ],

        tasks: [
            "Tasks",
            "Create and manage your study tasks."
        ],

        schedule: [
            "Schedule",
            "Plan your study sessions."
        ],

        progress: [
            "Progress",
            "Track your study progress."
        ],

        settings: [
            "Settings",
            "Manage your profile information."
        ]

    };


    const title =
        document.getElementById("pageTitle");

    const subtitle =
        document.getElementById("pageSubtitle");


    if (titles[page]) {

        title.textContent =
            titles[page][0];

        subtitle.textContent =
            titles[page][1];

    }


    window.scrollTo({
        top: 0,
        behavior: "smooth"
    });

}


// =========================================================
// RENDER EVERYTHING
// =========================================================

function renderEverything() {

    renderStats();

    renderSubjects();

    renderTasks();

    renderSchedule();

    renderDashboardTasks();

    renderDashboardSchedule();

    renderProgress();

    updateSubjectDropdowns();

}


// =========================================================
// STATS
// =========================================================

function renderStats() {

    const completed =
        tasks.filter(task =>
            Number(task.completed) === 1
        ).length;


    const total =
        tasks.length;


    const pending =
        total - completed;


    const progress =
        total === 0
            ? 0
            : Math.round(
                (completed / total) * 100
            );


    const subjectCount =
        document.getElementById("subjectCount");

    const completedCount =
        document.getElementById("completedCount");

    const pendingCount =
        document.getElementById("pendingCount");

    const progressValue =
        document.getElementById("progressValue");


    if (subjectCount) {
        subjectCount.textContent =
            subjects.length;
    }

    if (completedCount) {
        completedCount.textContent =
            completed;
    }

    if (pendingCount) {
        pendingCount.textContent =
            pending;
    }

    if (progressValue) {
        progressValue.textContent =
            progress + "%";
    }

}


// =========================================================
// SUBJECTS
// =========================================================

function renderSubjects() {

    const container =
        document.getElementById("subjectsList");

    if (!container) return;


    if (subjects.length === 0) {

        container.innerHTML = emptyState(
            "📚",
            "No subjects yet",
            "Add your first subject to start planning."
        );

        return;
    }


    container.innerHTML =
        subjects.map(subject => {

            const taskCount =
                Number(subject.task_count || 0);

            const completed =
                Number(subject.completed_tasks || 0);

            const percent =
                taskCount === 0
                    ? 0
                    : Math.round(
                        (completed / taskCount) * 100
                    );


            return `

                <div class="subject-card">

                    <div class="subject-top">

                        <div class="subject-icon">
                            📚
                        </div>

                        <button
                            class="icon-delete"
                            onclick="deleteSubject(${subject.id})"
                            title="Delete subject"
                        >
                            ×
                        </button>

                    </div>


                    <h3>
                        ${escapeHTML(subject.name)}
                    </h3>


                    <p>
                        ${
                            escapeHTML(
                                subject.description ||
                                "No description"
                            )
                        }
                    </p>


                    <div class="subject-footer">

                        <span>
                            ${taskCount} task${taskCount === 1 ? "" : "s"}
                        </span>

                        <span>
                            ${percent}%
                        </span>

                    </div>


                    <div class="mini-progress">

                        <div style="width:${percent}%"></div>

                    </div>

                </div>

            `;

        }).join("");

}


// =========================================================
// TASKS
// =========================================================

function renderTasks() {

    const container =
        document.getElementById("tasksList");

    if (!container) return;


    if (tasks.length === 0) {

        container.innerHTML = emptyState(
            "✓",
            "No tasks yet",
            "Add a task to organize your studies."
        );

        return;
    }


    container.innerHTML =
        tasks.map(task => {

            const completed =
                Number(task.completed) === 1;


            return `

                <div class="task-card ${completed ? "completed" : ""}">

                    <button
                        class="task-check ${completed ? "checked" : ""}"
                        onclick="toggleTask(${task.id})"
                        title="Mark complete"
                    >
                        ${completed ? "✓" : ""}
                    </button>


                    <div class="task-main">

                        <h3>
                            ${escapeHTML(task.name)}
                        </h3>


                        <div class="task-meta">

                            <span>
                                📚
                                ${escapeHTML(task.subject_name || "No Subject")}
                            </span>

                            <span>
                                📅
                                ${formatDate(task.due_date)}
                            </span>

                            ${
                                task.time
                                ? `
                                    <span>
                                        ⏰
                                        ${formatTime(task.time)}
                                    </span>
                                  `
                                : ""
                            }

                        </div>


                        ${
                            task.description
                            ? `
                                <p class="task-notes">
                                    ${escapeHTML(task.description)}
                                </p>
                              `
                            : ""
                        }

                    </div>


                    <button
                        class="icon-delete"
                        onclick="deleteTask(${task.id})"
                        title="Delete task"
                    >
                        ×
                    </button>

                </div>

            `;

        }).join("");

}


// =========================================================
// DASHBOARD TASKS
// =========================================================

function renderDashboardTasks() {

    const container =
        document.getElementById("dashboardTasks");

    if (!container) return;


    const pending =
        tasks
            .filter(task =>
                Number(task.completed) === 0
            )
            .slice(0, 5);


    if (pending.length === 0) {

        container.innerHTML = emptyState(
            "✓",
            "You're all caught up!",
            "No pending tasks."
        );

        return;
    }


    container.innerHTML =
        pending.map(task => `

            <div class="dashboard-item">

                <div class="item-dot"></div>

                <div>

                    <strong>
                        ${escapeHTML(task.name)}
                    </strong>

                    <span>
                        ${escapeHTML(task.subject_name || "No Subject")}
                    </span>

                </div>

                <small>
                    ${formatDate(task.due_date)}
                </small>

            </div>

        `).join("");

}


// =========================================================
// SCHEDULE
// =========================================================

function renderSchedule() {

    const container =
        document.getElementById("scheduleList");

    if (!container) return;


    if (schedule.length === 0) {

        container.innerHTML = emptyState(
            "◷",
            "No study sessions",
            "Add a study session to build your schedule."
        );

        return;
    }


    container.innerHTML =
        schedule.map(item => `

            <div class="schedule-card">

                <div class="schedule-date">

                    <strong>
                        ${getDay(item.study_date)}
                    </strong>

                    <span>
                        ${getMonth(item.study_date)}
                    </span>

                </div>


                <div class="schedule-info">

                    <h3>
                        ${escapeHTML(item.subject_name || "Study Session")}
                    </h3>

                    <p>
                        ⏰
                        ${formatTime(item.start_time)}
                        -
                        ${formatTime(item.end_time)}
                    </p>

                </div>


                <button
                    class="icon-delete"
                    onclick="deleteSchedule(${item.id})"
                    title="Delete session"
                >
                    ×
                </button>

            </div>

        `).join("");

}


// =========================================================
// DASHBOARD SCHEDULE
// =========================================================

function renderDashboardSchedule() {

    const container =
        document.getElementById("dashboardSchedule");

    if (!container) return;


    const upcoming =
        schedule.slice(0, 5);


    if (upcoming.length === 0) {

        container.innerHTML = emptyState(
            "◷",
            "No upcoming sessions",
            "Your planned study sessions will appear here."
        );

        return;
    }


    container.innerHTML =
        upcoming.map(item => `

            <div class="dashboard-item">

                <div class="schedule-mini-date">

                    ${getDay(item.study_date)}

                </div>

                <div>

                    <strong>
                        ${escapeHTML(item.subject_name || "Study Session")}
                    </strong>

                    <span>
                        ${formatTime(item.start_time)}
                        -
                        ${formatTime(item.end_time)}
                    </span>

                </div>

            </div>

        `).join("");

}


// =========================================================
// PROGRESS
// =========================================================

function renderProgress() {

    const total =
        tasks.length;


    const completed =
        tasks.filter(task =>
            Number(task.completed) === 1
        ).length;


    const pending =
        total - completed;


    const percentage =
        total === 0
            ? 0
            : Math.round(
                (completed / total) * 100
            );


    const largeProgress =
        document.getElementById("largeProgress");

    const progressTotal =
        document.getElementById("progressTotal");

    const progressCompleted =
        document.getElementById("progressCompleted");

    const progressPending =
        document.getElementById("progressPending");

    const circle =
        document.getElementById("progressCircle");


    if (largeProgress) {
        largeProgress.textContent =
            percentage + "%";
    }

    if (progressTotal) {
        progressTotal.textContent =
            total;
    }

    if (progressCompleted) {
        progressCompleted.textContent =
            completed;
    }

    if (progressPending) {
        progressPending.textContent =
            pending;
    }


    if (circle) {

        circle.style.setProperty(
            "--progress",
            percentage + "%"
        );

    }

}


// =========================================================
// DROPDOWNS
// =========================================================

function updateSubjectDropdowns() {

    const taskSelect =
        document.getElementById("taskSubject");

    const scheduleSelect =
        document.getElementById("scheduleSubject");


    if (taskSelect) {

        taskSelect.innerHTML =
            `<option value="">No Subject</option>`;


        subjects.forEach(subject => {

            taskSelect.innerHTML += `
                <option value="${subject.id}">
                    ${escapeHTML(subject.name)}
                </option>
            `;

        });

    }


    if (scheduleSelect) {

        scheduleSelect.innerHTML =
            `<option value="">General Study</option>`;


        subjects.forEach(subject => {

            scheduleSelect.innerHTML += `
                <option value="${subject.id}">
                    ${escapeHTML(subject.name)}
                </option>
            `;

        });

    }

}


// =========================================================
// FORMS
// =========================================================

function setupForms() {

    const subjectForm =
        document.getElementById("subjectForm");

    const taskForm =
        document.getElementById("taskForm");

    const scheduleForm =
        document.getElementById("scheduleForm");

    const settingsForm =
        document.getElementById("settingsForm");


    if (subjectForm) {

        subjectForm.addEventListener(
            "submit",
            addSubject
        );

    }


    if (taskForm) {

        taskForm.addEventListener(
            "submit",
            addTask
        );

    }


    if (scheduleForm) {

        scheduleForm.addEventListener(
            "submit",
            addSchedule
        );

    }


    if (settingsForm) {

        settingsForm.addEventListener(
            "submit",
            saveSettings
        );

    }

}


// =========================================================
// ADD SUBJECT
// =========================================================

async function addSubject(event) {

    event.preventDefault();


    const name =
        document.getElementById("subjectName")
            .value.trim();


    const description =
        document.getElementById("subjectDescription")
            .value.trim();


    try {

        const result =
            await api(
                "/api/subjects",
                {
                    method: "POST",

                    body: JSON.stringify({
                        name,
                        description
                    })
                }
            );


        if (result && result.success) {

            subjects.push(result.subject);

            closeModal("subjectModal");

            document
                .getElementById("subjectForm")
                .reset();

            renderEverything();

            showToast(
                result.message,
                "success"
            );
        }

    } catch (error) {

        // handled by api

    }

}


// =========================================================
// DELETE SUBJECT
// =========================================================

async function deleteSubject(id) {

    if (!confirm(
        "Delete this subject?"
    )) {
        return;
    }


    try {

        const result =
            await api(
                `/api/subjects/${id}`,
                {
                    method: "DELETE"
                }
            );


        if (result && result.success) {

            subjects =
                subjects.filter(
                    subject =>
                        Number(subject.id) !== Number(id)
                );


            tasks.forEach(task => {

                if (
                    Number(task.subject_id) === Number(id)
                ) {

                    task.subject_id = null;
                    task.subject_name = "No Subject";

                }

            });


            schedule.forEach(item => {

                if (
                    Number(item.subject_id) === Number(id)
                ) {

                    item.subject_id = null;
                    item.subject_name = "Study Session";

                }

            });


            renderEverything();

            showToast(
                result.message,
                "success"
            );
        }

    } catch (error) {

        // handled by api

    }

}


// =========================================================
// ADD TASK
// =========================================================

async function addTask(event) {

    event.preventDefault();


    const name =
        document.getElementById("taskName")
            .value.trim();


    const subjectId =
        document.getElementById("taskSubject")
            .value;


    const description =
        document.getElementById("taskDescription")
            .value.trim();


    const dueDate =
        document.getElementById("taskDate")
            .value;


    const time =
        document.getElementById("taskTime")
            .value;


    try {

        const result =
            await api(
                "/api/tasks",
                {
                    method: "POST",

                    body: JSON.stringify({
                        name,
                        subject_id:
                            subjectId || null,
                        description,
                        due_date:
                            dueDate,
                        time
                    })
                }
            );


        if (result && result.success) {

            const subject =
                subjects.find(
                    item =>
                        Number(item.id) ===
                        Number(subjectId)
                );


            const task =
                result.task;


            if (subject) {
                task.subject_name =
                    subject.name;
            }


            tasks.push(task);

            closeModal("taskModal");

            document
                .getElementById("taskForm")
                .reset();

            renderEverything();

            showToast(
                result.message,
                "success"
            );
        }

    } catch (error) {

        // handled by api

    }

}


// =========================================================
// TOGGLE TASK
// =========================================================

async function toggleTask(id) {

    try {

        const result =
            await api(
                `/api/tasks/${id}/toggle`,
                {
                    method: "PUT"
                }
            );


        if (result && result.success) {

            const task =
                tasks.find(
                    item =>
                        Number(item.id) === Number(id)
                );


            if (task) {

                task.completed =
                    result.completed ? 1 : 0;

            }


            renderEverything();

        }

    } catch (error) {

        // handled by api

    }

}


// =========================================================
// DELETE TASK
// =========================================================

async function deleteTask(id) {

    if (!confirm(
        "Delete this task?"
    )) {
        return;
    }


    try {

        const result =
            await api(
                `/api/tasks/${id}`,
                {
                    method: "DELETE"
                }
            );


        if (result && result.success) {

            tasks =
                tasks.filter(
                    task =>
                        Number(task.id) !== Number(id)
                );


            renderEverything();

            showToast(
                result.message,
                "success"
            );
        }

    } catch (error) {

        // handled by api

    }

}


// =========================================================
// ADD SCHEDULE
// =========================================================

async function addSchedule(event) {

    event.preventDefault();


    const subjectId =
        document.getElementById("scheduleSubject")
            .value;


    const studyDate =
        document.getElementById("scheduleDate")
            .value;


    const startTime =
        document.getElementById("scheduleStart")
            .value;


    const endTime =
        document.getElementById("scheduleEnd")
            .value;


    if (startTime >= endTime) {

        showToast(
            "End time must be after start time.",
            "error"
        );

        return;
    }


    try {

        const result =
            await api(
                "/api/schedule",
                {
                    method: "POST",

                    body: JSON.stringify({
                        subject_id:
                            subjectId || null,
                        study_date:
                            studyDate,
                        start_time:
                            startTime,
                        end_time:
                            endTime
                    })
                }
            );


        if (result && result.success) {

            const item =
                result.schedule;


            const subject =
                subjects.find(
                    subject =>
                        Number(subject.id) ===
                        Number(subjectId)
                );


            if (subject) {

                item.subject_name =
                    subject.name;

            }


            schedule.push(item);


            schedule.sort(
                compareSchedule
            );


            closeModal("scheduleModal");


            document
                .getElementById("scheduleForm")
                .reset();


            renderEverything();


            showToast(
                result.message,
                "success"
            );

        }

    } catch (error) {

        // handled by api

    }

}


// =========================================================
// DELETE SCHEDULE
// =========================================================

async function deleteSchedule(id) {

    if (!confirm(
        "Delete this study session?"
    )) {
        return;
    }


    try {

        const result =
            await api(
                `/api/schedule/${id}`,
                {
                    method: "DELETE"
                }
            );


        if (result && result.success) {

            schedule =
                schedule.filter(
                    item =>
                        Number(item.id) !== Number(id)
                );


            renderEverything();

            showToast(
                result.message,
                "success"
            );
        }

    } catch (error) {

        // handled by api

    }

}


// =========================================================
// SETTINGS
// =========================================================

async function saveSettings(event) {

    event.preventDefault();


    const name =
        document.getElementById("settingsName")
            .value.trim();


    const email =
        document.getElementById("settingsEmail")
            .value.trim();


    try {

        const result =
            await api(
                "/api/user/update",
                {
                    method: "PUT",

                    body: JSON.stringify({
                        name,
                        email
                    })
                }
            );


        if (result && result.success) {

            currentUser.name =
                name;

            currentUser.email =
                email;


            displayUser();


            showToast(
                result.message,
                "success"
            );
        }

    } catch (error) {

        // handled by api

    }

}


// =========================================================
// MODALS
// =========================================================

function openSubjectModal() {

    const modal =
        document.getElementById("subjectModal");

    if (!modal) return;

    modal.classList.add("show");

    setTimeout(() => {

        document
            .getElementById("subjectName")
            ?.focus();

    }, 100);

}


function openTaskModal() {

    const modal =
        document.getElementById("taskModal");

    if (!modal) return;

    const dateInput =
        document.getElementById("taskDate");


    if (dateInput && !dateInput.value) {

        dateInput.value =
            getTodayString();

    }


    modal.classList.add("show");

}


function openScheduleModal() {

    const modal =
        document.getElementById("scheduleModal");

    if (!modal) return;


    const dateInput =
        document.getElementById("scheduleDate");


    if (dateInput && !dateInput.value) {

        dateInput.value =
            getTodayString();

    }


    modal.classList.add("show");

}


function closeModal(id) {

    const modal =
        document.getElementById(id);

    if (modal) {
        modal.classList.remove("show");
    }

}


function setupModalEvents() {

    document
        .querySelectorAll(".modal-overlay")
        .forEach(modal => {

            modal.addEventListener(
                "click",
                event => {

                    if (
                        event.target === modal
                    ) {

                        modal.classList.remove(
                            "show"
                        );

                    }

                }
            );

        });


    document.addEventListener(
        "keydown",
        event => {

            if (event.key !== "Escape") {
                return;
            }


            document
                .querySelectorAll(".modal-overlay.show")
                .forEach(modal => {

                    modal.classList.remove(
                        "show"
                    );

                });

        }
    );

}


// =========================================================
// UTILITY
// =========================================================

function getTodayString() {

    const date =
        new Date();


    const year =
        date.getFullYear();


    const month =
        String(
            date.getMonth() + 1
        ).padStart(2, "0");


    const day =
        String(
            date.getDate()
        ).padStart(2, "0");


    return `${year}-${month}-${day}`;

}


function formatDate(dateString) {

    if (!dateString) {
        return "";
    }


    const date =
        new Date(
            dateString + "T00:00:00"
        );


    return date.toLocaleDateString(
        "en-IN",
        {
            day: "numeric",
            month: "short",
            year: "numeric"
        }
    );

}


function formatTime(time) {

    if (!time) {
        return "";
    }


    const parts =
        time.split(":");


    let hour =
        parseInt(parts[0], 10);

    const minute =
        parts[1];


    const period =
        hour >= 12
            ? "PM"
            : "AM";


    hour =
        hour % 12 || 12;


    return `${hour}:${minute} ${period}`;

}


function getDay(dateString) {

    const date =
        new Date(
            dateString + "T00:00:00"
        );


    return date.getDate();

}


function getMonth(dateString) {

    const date =
        new Date(
            dateString + "T00:00:00"
        );


    return date.toLocaleDateString(
        "en-IN",
        {
            month: "short"
        }
    );

}


function compareSchedule(a, b) {

    const first =
        `${a.study_date} ${a.start_time}`;

    const second =
        `${b.study_date} ${b.start_time}`;


    return first.localeCompare(second);

}


function escapeHTML(value) {

    if (value === null ||
        value === undefined) {

        return "";

    }


    return String(value)
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;")
        .replace(/'/g, "&#039;");

}


function emptyState(
    icon,
    title,
    message
) {

    return `

        <div class="empty-state">

            <div class="empty-icon">
                ${icon}
            </div>

            <h3>
                ${title}
            </h3>

            <p>
                ${message}
            </p>

        </div>

    `;

}


// =========================================================
// TOAST
// =========================================================

let toastTimer;


function showToast(
    message,
    type = "success"
) {

    const toast =
        document.getElementById("toast");


    if (!toast) return;


    clearTimeout(toastTimer);


    toast.textContent =
        message;


    toast.className =
        "toast show " + type;


    toastTimer =
        setTimeout(() => {

            toast.classList.remove(
                "show"
            );

        }, 3000);

}
/* ==========================================================================
   TASKS.JS
   The task manager: adding, editing, deleting, completing, searching and
   filtering tasks. All tasks are kept in appData.tasks and saved through
   the storage module after every change.
   ========================================================================== */

const FocusBeatTasks = (function () {

  let appData = null;
  let currentFilter = "all";
  let searchTerm = "";
  let taskIdBeingEdited = null;

  // Cached DOM elements.
  let elements = {};

  // -------------------- Helpers --------------------

  function generateTaskId() {
    return Date.now() + Math.floor(Math.random() * 1000);
  }

  function getVisibleTasks() {
    return appData.tasks.filter((task) => {
      const matchesFilter =
        currentFilter === "all" ||
        (currentFilter === "active" && !task.completed) ||
        (currentFilter === "completed" && task.completed);

      const matchesSearch = task.text.toLowerCase().includes(searchTerm.toLowerCase());

      return matchesFilter && matchesSearch;
    });
  }

  function persistAndRefresh() {
    FocusBeatStorage.save(appData);
    renderTaskList();
    updateFilterCounts();
    document.dispatchEvent(new CustomEvent("focusbeat:dataChanged"));
  }

  // -------------------- CRUD actions --------------------

  function addTask(text) {
    const trimmedText = text.trim();
    if (!trimmedText) return;

    appData.tasks.unshift({
      id: generateTaskId(),
      text: trimmedText,
      completed: false,
      createdAt: Date.now()
    });

    persistAndRefresh();
    window.FocusBeatToast.show("Task added");
  }

  function deleteTask(taskId) {
    appData.tasks = appData.tasks.filter((task) => task.id !== taskId);
    persistAndRefresh();
    window.FocusBeatToast.show("Task deleted");
  }

  function toggleTaskCompleted(taskId) {
    const task = appData.tasks.find((task) => task.id === taskId);
    if (!task) return;

    task.completed = !task.completed;
    persistAndRefresh();
  }

  function openEditModal(taskId) {
    const task = appData.tasks.find((task) => task.id === taskId);
    if (!task) return;

    taskIdBeingEdited = taskId;
    elements.editTaskInput.value = task.text;
    elements.editModalOverlay.classList.remove("hidden");
    elements.editTaskInput.focus();
  }

  function closeEditModal() {
    elements.editModalOverlay.classList.add("hidden");
    taskIdBeingEdited = null;
  }

  function saveEditedTask() {
    const newText = elements.editTaskInput.value.trim();
    if (!newText || taskIdBeingEdited === null) {
      closeEditModal();
      return;
    }

    const task = appData.tasks.find((task) => task.id === taskIdBeingEdited);
    if (task) {
      task.text = newText;
      persistAndRefresh();
    }

    closeEditModal();
  }

  // -------------------- Rendering --------------------

  function renderTaskList() {
    const visibleTasks = getVisibleTasks();
    elements.taskList.innerHTML = "";
    elements.noTasksMessage.classList.toggle("hidden", visibleTasks.length > 0);

    visibleTasks.forEach((task) => {
      const taskRow = document.createElement("div");
      taskRow.className = "task-item";
      taskRow.dataset.taskId = task.id;

      taskRow.innerHTML = `
        <button class="task-checkbox ${task.completed ? "checked" : ""}" aria-label="Toggle complete">
          ${task.completed ? "✓" : ""}
        </button>
        <span class="task-text ${task.completed ? "completed" : ""}"></span>
        <div class="task-actions">
          <button class="task-action-btn edit-btn" title="Edit task">✎</button>
          <button class="task-action-btn delete-btn" title="Delete task">🗑</button>
        </div>
      `;

      // Setting text via textContent (rather than innerHTML) keeps user
      // input from ever being interpreted as markup.
      taskRow.querySelector(".task-text").textContent = task.text;

      taskRow.querySelector(".task-checkbox").addEventListener("click", () => toggleTaskCompleted(task.id));
      taskRow.querySelector(".edit-btn").addEventListener("click", () => openEditModal(task.id));
      taskRow.querySelector(".delete-btn").addEventListener("click", () => deleteTask(task.id));

      elements.taskList.appendChild(taskRow);
    });
  }

  function updateFilterCounts() {
    const total = appData.tasks.length;
    const active = appData.tasks.filter((task) => !task.completed).length;
    const completed = total - active;

    elements.countAll.textContent = total;
    elements.countActive.textContent = active;
    elements.countDone.textContent = completed;
  }

  // -------------------- Init --------------------

  function cacheElements() {
    elements = {
      newTaskInput: document.getElementById("newTaskInput"),
      addTaskButton: document.getElementById("addTaskButton"),
      taskList: document.getElementById("taskList"),
      noTasksMessage: document.getElementById("noTasksMessage"),
      filterButtons: Array.from(document.querySelectorAll(".filter-btn")),
      countAll: document.getElementById("countAll"),
      countActive: document.getElementById("countActive"),
      countDone: document.getElementById("countDone"),
      taskSearchInput: document.getElementById("taskSearchInput"),
      editModalOverlay: document.getElementById("editModalOverlay"),
      editTaskInput: document.getElementById("editTaskInput"),
      closeEditModal: document.getElementById("closeEditModal"),
      cancelEditBtn: document.getElementById("cancelEditBtn"),
      saveEditBtn: document.getElementById("saveEditBtn")
    };
  }

  function bindEvents() {
    elements.addTaskButton.addEventListener("click", () => {
      addTask(elements.newTaskInput.value);
      elements.newTaskInput.value = "";
      elements.newTaskInput.focus();
    });

    elements.newTaskInput.addEventListener("keydown", (event) => {
      if (event.key === "Enter") {
        addTask(elements.newTaskInput.value);
        elements.newTaskInput.value = "";
      }
    });

    elements.filterButtons.forEach((button) => {
      button.addEventListener("click", () => {
        currentFilter = button.dataset.filter;
        elements.filterButtons.forEach((b) => b.classList.toggle("active", b === button));
        renderTaskList();
      });
    });

    elements.taskSearchInput.addEventListener("input", (event) => {
      searchTerm = event.target.value;
      renderTaskList();
    });

    elements.closeEditModal.addEventListener("click", closeEditModal);
    elements.cancelEditBtn.addEventListener("click", closeEditModal);
    elements.saveEditBtn.addEventListener("click", saveEditedTask);

    elements.editTaskInput.addEventListener("keydown", (event) => {
      if (event.key === "Enter") saveEditedTask();
    });
  }

  function init(sharedData) {
    appData = sharedData;
    cacheElements();
    bindEvents();
    renderTaskList();
    updateFilterCounts();
  }

  return { init: init };

})();
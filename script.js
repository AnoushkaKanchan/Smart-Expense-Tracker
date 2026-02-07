
let savingsMode = "strict"; 
// "strict" | "practical"

// =====================
// DATA LAYER
// =====================
let expenses = [];
let monthlyIncome = {};   // { "YYYY-MM": number }
let monthlyBudget = {};   // { "YYYY-MM": number }
let editingId = null;
let alertState = {}; 
let categoryPieChart = null;
let listenersAttached = false;

// =====================
// SAVINGS DATA
// =====================
let savingsGoals = [];
/*
Each goal:
{
  id: string,
  name: string,
  targetAmount: number,
  savedAmount: number,
  startMonthKey: string,
  targetMonthKey: string | null,
  paused: boolean
}
*/


let savingsLedger = {};
// { "YYYY-MM": [ { goalId, amount } ] }

function loadState() {
  expenses = JSON.parse(localStorage.getItem("expenses")) || [];
  monthlyIncome = JSON.parse(localStorage.getItem("monthlyIncome")) || {};
  monthlyBudget = JSON.parse(localStorage.getItem("monthlyBudget")) || {};
  savingsGoals = JSON.parse(localStorage.getItem("savingsGoals")) || [];
  savingsLedger = JSON.parse(localStorage.getItem("savingsLedger")) || {};
  savingsMode = localStorage.getItem("savingsMode") || "strict";
  
}
loadState();
updateToggleSwitch();
updateSavingsModeHelp();


// =====================
// MONTH HANDLING
// =====================
const monthInput = document.getElementById("month-selector");
const now = new Date();
monthInput.value = `${now.getFullYear()}-${String(now.getMonth()+1).padStart(2,"0")}`;

function getSelectedMonth() {
  return monthInput.value;
}

// =====================
// HELPERS
// =====================
function generateId() {
  return Date.now().toString();
}

function getExpensesForMonth(monthKey) {
  return expenses.filter(e => e.date.startsWith(monthKey));
}

function sumExpenses(monthKey) {
  return getExpensesForMonth(monthKey)
    .reduce((s, e) => s + e.amount, 0);
}

function getIncome(monthKey) {
  return Object.prototype.hasOwnProperty.call(monthlyIncome, monthKey)
    ? monthlyIncome[monthKey]
    : null;
}

function getBudget(monthKey) {
  return Object.prototype.hasOwnProperty.call(monthlyBudget, monthKey)
    ? monthlyBudget[monthKey]
    : null;
}

function daysInMonth(monthKey) {
  const [y, m] = monthKey.split("-");
  return new Date(y, m, 0).getDate();
}

function daysPassed(monthKey) {
  const today = new Date();
  const [y, m] = monthKey.split("-");
  if (today.getFullYear() != y || today.getMonth()+1 != m) return 0;
  return today.getDate();
}

// =====================
// SAVINGS HELPERS
// =====================
function getGoalMonthlySaved(goalId, monthKey) {
  const entries = savingsLedger[monthKey] || [];
  return entries
    .filter(e => e.goalId === goalId)
    .reduce((sum, e) => sum + e.amount, 0);
}

function updateSavingsCapacityAmount(monthKey) {
  const el = document.getElementById("savings-capacity");
  if (!el) return;

  const capacity = getMonthlySavingsCapacity(monthKey);

  el.innerText = `${capacity}`;
}

function getMonthlySavingsCapacity(monthKey) {
  const income = getIncome(monthKey);
  const expenses = sumExpenses(monthKey);
  const budget = getBudget(monthKey);

  if (income === null) return 0;

  // PRACTICAL MODE
  if (savingsMode === "practical") {
    return Math.max(0, income - expenses);
    
  }

  // STRICT MODE (default)
  if (budget === null) return 0;

  return Math.max(0, income - expenses - budget);
}


function updateToggleSwitch() {
  const labels = document.getElementsByClassName("form-check-label");
  if (!labels.length) return;

  const label = labels[0]; // 👈 get the actual element

  if (savingsMode === "practical") {
    label.innerText = "Flexible saving";
  } else {
    label.innerText = "Safe saving";
  }

  updateSavingsModeHelp();
}


function updateSavingsModeHelp() {
  const help = document.getElementById("savings-mode-help");
  if (!help) return;

  if (savingsMode === "practical") {
    help.innerText =
      "Savings are calculated from your current balance, like most people do in real life.";
  } else {
    help.innerText =
      "Savings are calculated conservatively, protecting your planned spending.";
  }
}


function getPreviousMonth(monthKey) {
  const [y, m] = monthKey.split("-").map(Number);
  const date = new Date(y, m - 1, 1);
  date.setMonth(date.getMonth() - 1);
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}`;
}

function getCategoryTotals(monthKey) {
  const map = {};
  getExpensesForMonth(monthKey).forEach(e => {
    map[e.category] = (map[e.category] || 0) + e.amount;
  });
  return map;
}

//Insight 1: Category Dominance

function categoryDominanceInsight(monthKey) {
  const categories = getCategoryTotals(monthKey);
  const entries = Object.entries(categories);
  if (entries.length === 0) return null;

  const [topCategory, amount] = entries.reduce((a, b) =>
    b[1] > a[1] ? b : a
  );

  return `Most of your money this month went to ${topCategory} (₹${amount}).`;
}

//Insight 2: Month-over-Month Comparison

function monthComparisonInsight(monthKey) {
  const prevMonth = getPreviousMonth(monthKey);

  const currentSpent = sumExpenses(monthKey);
  const prevSpent = sumExpenses(prevMonth);

  if (prevSpent === 0) return null;

  const diff = currentSpent - prevSpent;
  if (diff === 0) return null;

  return diff > 0
    ? `You spent ₹${diff} more this month than last month.`
    : `You spent ₹${Math.abs(diff)} less this month than last month.`;
}

//Insight 3: Daily Spend Awareness
function dailySpendInsight(monthKey) {
  const spent = sumExpenses(monthKey);
  const passed = daysPassed(monthKey);

  if (passed === 0 || spent === 0) return null;

  const avgDaily = Math.round(spent / passed);
  const safe = safeDailySpend(monthKey);

  if (safe === null) return null;

  return `You’re spending ₹${avgDaily}/day. To stay within budget, aim for ₹${safe}/day.`;
}

//Insight 4: Budget Risk Insight
function budgetRiskInsight(monthKey) {
  const budget = getBudget(monthKey);
  if (budget === null) return null;

  const spent = sumExpenses(monthKey);
  const spentPercent = (spent / budget) * 100;

  const totalDays = daysInMonth(monthKey);
  const passedDays = daysPassed(monthKey);
  const timePercent = (passedDays / totalDays) * 100;

  if (spentPercent >= 70 && spentPercent > timePercent) {
    return `You’ve used ${Math.round(spentPercent)}% of your budget with ${Math.round(
      100 - timePercent
    )}% of the month left.`;
  }

  return null;
}

//Collect All Insights (NO CACHING)

function generateInsights(monthKey) {
  const insights = [];

  const i1 = categoryDominanceInsight(monthKey);
  const i2 = monthComparisonInsight(monthKey);
  const i3 = dailySpendInsight(monthKey);
  const i4 = budgetRiskInsight(monthKey);

  [i1, i2, i3, i4].forEach(i => {
    if (i) insights.push(i);
  });

  return insights.slice(0, 5); // UX constraint
}

function getAlertBucket(monthKey) {
  if (!alertState[monthKey]) {
    alertState[monthKey] = {
      budget80: false,
      earlyBurn: false,
      largeExpenses: new Set(),
      category: {}
    };
  }
  return alertState[monthKey];
}

//Alert 1: Budget ≥ 80%
function budgetThresholdAlert(monthKey) {
  const budget = getBudget(monthKey);
  if (budget === null) return null;

  const spent = sumExpenses(monthKey);
  const usage = spent / budget;

  const bucket = getAlertBucket(monthKey);

  if (usage >= 0.8 && !bucket.budget80) {
    bucket.budget80 = true;
    return "You’ve used 80% of your monthly budget. Keep an eye on upcoming expenses.";
  }

  return null;
}

//Alert 2: Early Budget Burn (Time-Aware)
function earlyBurnAlert(monthKey) {
  const budget = getBudget(monthKey);
  if (budget === null) return null;

  const spentPercent = sumExpenses(monthKey) / budget;
  const timePercent = daysPassed(monthKey) / daysInMonth(monthKey);

  const bucket = getAlertBucket(monthKey);

  if (spentPercent > timePercent && !bucket.earlyBurn) {
    bucket.earlyBurn = true;
    return "You’re spending faster than planned for this point in the month.";
  }

  return null;
}

//Alert 3: Large Single Expense
function largeExpenseAlert(monthKey, expense) {
  const budget = getBudget(monthKey);
  const bucket = getAlertBucket(monthKey);

  if (!budget) return null;

  const avg =
    getExpensesForMonth(monthKey).reduce((s, e) => s + e.amount, 0) /
    Math.max(getExpensesForMonth(monthKey).length, 1);

  const isLarge =
    expense.amount > 0.2 * budget ||
    expense.amount > 2 * avg;

  if (isLarge && !bucket.largeExpenses.has(expense.id)) {
    bucket.largeExpenses.add(expense.id);
    return "This expense is higher than your usual spending.";
  }

  return null;
}

//Alert Aggregator (CALLED ON EVERY CHANGE)
function evaluateAlerts(monthKey, latestExpense = null) {
  const alerts = [];

  const a1 = budgetThresholdAlert(monthKey);
  const a2 = earlyBurnAlert(monthKey);

  if (a1) alerts.push(a1);
  if (a2) alerts.push(a2);

  if (latestExpense) {
    const a3 = largeExpenseAlert(monthKey, latestExpense);
    if (a3) alerts.push(a3);
  }

  return alerts;
}


// =====================
// CALCULATIONS (LOCKED)
// =====================
function remainingBalance(monthKey) {
  const income = getIncome(monthKey);
  if (income === null) return null;
  return income - sumExpenses(monthKey);
}

function budgetRemaining(monthKey) {
  const budget = getBudget(monthKey);
  if (budget === null) return null;
  return budget - sumExpenses(monthKey);
}

function safeDailySpend(monthKey) {
  const remaining = budgetRemaining(monthKey);
  if (remaining === null) return null;

  const totalDays = daysInMonth(monthKey);
  const passed = daysPassed(monthKey);
  const left = totalDays - passed;

  if (left <= 0) return null;

  return Math.floor(remaining / left);
}

// =====================
// LOGIC LAYER
// =====================
function setIncome(monthKey, value) {
  if (value < 0 || isNaN(value)) return;
  monthlyIncome[monthKey] = value;
  saveState();
}

function setBudget(monthKey, value) {
  if (value < 0 || isNaN(value)) return;
  monthlyBudget[monthKey] = value;
  saveState();
}

function createSavingsGoal({ name, targetAmount, startMonthKey, targetMonthKey }) {
  if (!name || targetAmount <= 0) return false;

  savingsGoals.push({
    id: generateId(),
    name,
    targetAmount,
    savedAmount: 0,
    startMonthKey,
    targetMonthKey: targetMonthKey || null,
    paused: false
  });

  return true;
}

function deleteSavingsGoal(goalId) {
  // remove goal
  savingsGoals = savingsGoals.filter(g => g.id !== goalId);

  // remove ledger entries related to this goal
  Object.keys(savingsLedger).forEach(monthKey => {
    savingsLedger[monthKey] = savingsLedger[monthKey].filter(
      entry => entry.goalId !== goalId
    );

    // clean empty months
    if (savingsLedger[monthKey].length === 0) {
      delete savingsLedger[monthKey];
    }
  });

  saveState();
}


function allocateSavings(monthKey, goalId, amount) {
  const capacity = getMonthlySavingsCapacity(monthKey);
  if (amount <= 0 || amount > capacity) {
    return { success: false, reason: "NO_CAPACITY" };
  }

  const goal = savingsGoals.find(g => g.id === goalId);
  if (!goal || goal.paused) {
    return { success: false, reason: "INVALID_GOAL" };
  }

  // 🚫 Goal already completed
  if (goal.savedAmount >= goal.targetAmount) {
    return { success: false, reason: "GOAL_LIMIT" };
  }

  // 🚫 Allocation would exceed target
  if (goal.savedAmount + amount > goal.targetAmount) {
    return { success: false, reason: "GOAL_LIMIT" };
  }

  // ✅ Allocate
  goal.savedAmount += amount;

  if (!savingsLedger[monthKey]) {
    savingsLedger[monthKey] = [];
  }

  savingsLedger[monthKey].push({ goalId, amount });

  saveState();
  return { success: true };
}




function getGoalProgress(goal) {
  return Math.min(
    100,
    Math.round((goal.savedAmount / goal.targetAmount) * 100)
  );
}

function monthsBetween(fromKey, toKey) {
  const [fy, fm] = fromKey.split("-").map(Number);
  const [ty, tm] = toKey.split("-").map(Number);

  return (ty - fy) * 12 + (tm - fm);
}

function suggestedMonthlySaving(goal, currentMonthKey) {
  if (!goal.targetMonthKey) return null;

  const monthsLeft = monthsBetween(currentMonthKey, goal.targetMonthKey);
  if (monthsLeft <= 0) return null;

  const remaining = goal.targetAmount - goal.savedAmount;
  if (remaining <= 0) return null;

  return Math.ceil(remaining / monthsLeft);
}


function addExpense(exp) {
  expenses.push(exp);
  saveState();
}


function deleteExpense(id) {
  expenses = expenses.filter(e => e.id !== id);
  saveState();
}

function updateExpense(id, updatedData) {
  expenses = expenses.map(exp =>
    exp.id === id ? { ...exp, ...updatedData } : exp
  );
  saveState();
}

function startEdit(id) {
  const exp = expenses.find(e => e.id === id);
  if (!exp) return;

  document.getElementById("amount").value = exp.amount;
  document.getElementById("category").value = exp.category;
  document.getElementById("date").value = exp.date;
  document.getElementById("note").value = exp.note || "";

  editingId = id;
}


// =====================
// RENDER
// =====================
function render() {
  const monthKey = getSelectedMonth();

  const income = getIncome(monthKey);
  const spent = sumExpenses(monthKey);
  const remaining = remainingBalance(monthKey);
  const budgetRem = budgetRemaining(monthKey);
  const safeDaily = safeDailySpend(monthKey);

  const list = document.getElementById("expense-list");
  list.innerHTML = "";

  getExpensesForMonth(monthKey).forEach(e => {
    const li = document.createElement("li");
    li.className = "list-group-item d-flex align-items-center gap-2";

    const text = document.createElement("span");
    text.innerText = `₹${e.amount} | ${e.category} | ${e.date}`;
    text.className = "flex-grow-1";

    const editBtn = document.createElement("button");
    editBtn.innerText = "Edit";
    editBtn.className = "btn btn-sm btn-outline-primary";
    editBtn.addEventListener("click", () => startEdit(e.id));

    const deleteBtn = document.createElement("button");
    deleteBtn.innerText = "Delete";
    deleteBtn.className = "btn btn-sm btn-outline-danger";
    deleteBtn.addEventListener("click", () => handleDelete(e.id));

    li.appendChild(text);
    li.appendChild(editBtn);
    li.appendChild(deleteBtn);

    list.appendChild(li);
  });

  const insightsList = document.getElementById("dash-insight");
  insightsList.innerHTML = "";

  const insights = generateInsights(monthKey);
  insights.forEach(text => {
    const li = document.createElement("li");
    li.className = "list-group-item";
    li.innerText = text;
    insightsList.appendChild(li);
  });
  const list1 = document.getElementById("expense-list");
   if (!list1) return;

renderSavingsGoals();
updateSavingsCapacityExplain(monthKey);
}

//Dashboard update

function renderDashboard() {
  const monthKey = getSelectedMonth();

  const income = getIncome(monthKey);
  const expenses = sumExpenses(monthKey);
  const remaining = remainingBalance(monthKey);
  const budgetRem = budgetRemaining(monthKey);

  document.getElementById("dash-income").innerText =
    income === null ? "Not set" : `₹${income}`;

  document.getElementById("dash-expenses").innerText = `₹${expenses}`;

  const remainingEl = document.getElementById("dash-remaining");
  remainingEl.innerText =
    remaining === null ? "Not set" : `₹${remaining}`;

  // visually obvious overspending
  remainingEl.className =
    remaining !== null && remaining < 0
      ? "text-danger"
      : "text-success";

  document.getElementById("dash-budget-remaining").innerText =
    budgetRem === null ? "—" : `₹${budgetRem}`;
}


//renderBudgetProgress
function renderBudgetProgress() {
  const monthKey = getSelectedMonth();

  const income = getIncome(monthKey);
  const budget = getBudget(monthKey);

  const bar = document.getElementById("budget-progress");
  const text = document.getElementById("budget-usage-text");

  if (!bar || !text) return;

  // 🔒 Guard: budget usage is meaningless without income + budget
  if (income === null || budget === null) {
    bar.style.width = "0%";
    bar.className = "progress-bar bg-secondary";
    bar.innerText = "";
    text.innerText = "Set income and budget to evaluate usage";
    return;
  }

  const spent = sumExpenses(monthKey);
  const percent = Math.min(100, Math.round((spent / budget) * 100));

  bar.style.width = `${percent}%`;
  bar.innerText = `${percent}%`;

  bar.className =
    percent >= 100
      ? "progress-bar bg-danger"
      : percent >= 80
      ? "progress-bar bg-warning"
      : "progress-bar bg-success";

  text.innerText = `${percent}% of budget used`;
}


// =====================
// RENDER dashboard insihts
// =====================

function renderDashboardMeta() {
  const insightEl = document.getElementById("dash-insight");
  if (!insightEl) return;

  const insights = generateInsights(getSelectedMonth());
  insightEl.innerText =
    insights.length > 0
      ? insights[0]
      : "No notable pattern yet.";
}



// =====================
// RENDER charts
// =====================
function renderCategoryPie() {
  const monthKey = getSelectedMonth();
  const totals = getCategoryTotals(monthKey);
  const totalExpenses = sumExpenses(monthKey);

  const canvas = document.getElementById("categoryPie");
  const emptyText = document.getElementById("categoryPieEmpty");
  if (!canvas) return;

  // No expenses → hide chart
  if (totalExpenses === 0) {
    if (categoryPieChart) {
      categoryPieChart.destroy();
      categoryPieChart = null;
    }
    emptyText.innerText = "No spending data for this month.";
    return;
  }

  emptyText.innerText = "";

  const labels = Object.keys(totals);
  const data = Object.values(totals);

  if (categoryPieChart) {
    categoryPieChart.destroy();
  }

  categoryPieChart = new Chart(canvas, {
    type: "pie",
    data: {
      labels,
      datasets: [
        {
          data,
          backgroundColor: [
            "#4e79a7",
            "#f28e2b",
            "#e15759",
            "#76b7b2",
            "#59a14f",
            "#edc948",
            "#b07aa1"
          ]
        }
      ]
    },
    options: {
  responsive: true,
  maintainAspectRatio: false, // 👈 REQUIRED for fixed size
  plugins: {
    legend: {
      position: "bottom",
      labels: {
        boxWidth: 12,
        padding: 10,
        font: {
          size: 11
        }
      }
    }
  }
}
  });
}


// =====================
// RENDER SAVINGS GOALS
// =====================
function renderSavingsGoals() {
  const list = document.getElementById("goals-list");
  list.innerHTML = "";

  savingsGoals.forEach(goal => {
    const monthKey = getSelectedMonth();
    const savedThisMonth = getGoalMonthlySaved(goal.id, monthKey);
    const li = document.createElement("li");
    li.className = "list-group-item";
    li.dataset.goalId = goal.id; // 🔑 required for delegation

    const progress = getGoalProgress(goal);

    li.innerHTML = `
  <div class="d-flex justify-content-between align-items-center">
    <strong>${goal.name}</strong>
    <span>${getGoalProgress(goal)}%</span>
  </div>

  <small class="text-muted">
    Saved so far: ₹${goal.savedAmount} / ₹${goal.targetAmount}
  </small><br>

  <small class="text-muted">
    Saved this month: ₹${savedThisMonth}
  </small>

  <div class="input-group mt-2">
    <input
      type="number"
      class="form-control allocation-input"
      placeholder="Allocate money to this goal"
      min="1"
    />
    <button class="btn btn-outline-success allocate-btn">
      Allocate
    </button>
  </div>

  <button class="btn btn-sm btn-outline-danger mt-2 delete-goal-btn">
    Delete Goal
  </button>
`;

    list.appendChild(li);
  });

  const list1 = document.getElementById("expense-list");
  if (!list1) return;

}

document
  .getElementById("goals-list")
  .addEventListener("click", function (e) {
    const li = e.target.closest("li");
    if (!li) return;

    const goalId = li.dataset.goalId;
    const goal = savingsGoals.find(g => g.id === goalId);
    if (!goal) return;

    // ✅ Allocate savings
    if (e.target.classList.contains("allocate-btn")) {
      const input = li.querySelector(".allocation-input");
      const amount = Number(input.value);
      if (!amount) return;

      const success = allocateSavings(
        getSelectedMonth(),
        goalId,
        amount
      );

     const result = allocateSavings(getSelectedMonth(), goalId, amount);

if (!result.success) {
  if (result.reason === "GOAL_LIMIT") {
    alert("Goal limit reached. This goal is already complete.");
  } else {
    alert(
      savingsMode === "strict"
        ? "There isn’t any money that’s safe to save this month."
        : "You don’t have extra balance available to save right now."
    );
  }
  return;
}


      input.value = "";
      saveState();
      renderSavingsGoals();
    }

    // ❌ Delete goal
    if (e.target.classList.contains("delete-goal-btn")) {
      if (!confirm(`Delete savings goal "${goal.name}"?`)) return;
      deleteSavingsGoal(goalId);
      renderSavingsGoals();
    }
  });


// =====================
// ALERT RENDER (UI ONLY)
// =====================
function renderAlerts(alerts) {
  const container = document.getElementById("alerts-list");
  if (!container) return;

  container.innerHTML = "";

  alerts.forEach(text => {
    const div = document.createElement("div");
    div.className = "alert alert-warning mb-2";
    div.innerText = text;
    container.appendChild(div);
  });
}



function resetAlertStateForMonth(monthKey) {
  if (!alertState[monthKey]) {
    alertState[monthKey] = {
      budget80: false,
      earlyBurn: false,
      largeExpenses: new Set(),
      category: {}
    };
  }
}


// ===== Savings capacity UI (NO FORMULAS SHOWN) =====
function updateSavingsCapacityExplain(monthKey) {
  const el = document.getElementById("savings-capacity-explain");
  if (!el) return;

  const capacity = getMonthlySavingsCapacity(monthKey);

  if (capacity === 0) {
    el.innerText =
      savingsMode === "strict"
        ? "All of your money this month is already planned for spending."
        : "There’s no extra balance available right now.";
  } else {
    el.innerText =
      savingsMode === "strict"
        ? "This amount is safe to save without affecting your planned expenses."
        : "This amount is available based on your current balance.";
  }
}


// =====================
// EVENT HANDLER
// =====================

const savingsModeToggle = document.getElementById("savings-mode-toggle");
// set initial toggle position
if (savingsModeToggle) {
  savingsModeToggle.checked = savingsMode === "practical";

  savingsModeToggle.addEventListener("change", () => {
    savingsMode = savingsModeToggle.checked ? "practical" : "strict";

    localStorage.setItem("savingsMode", savingsMode);
    updateToggleSwitch();
    updateSavingsCapacityAmount(getSelectedMonth());
    renderAll();
  });
}

function handleDelete(id) {
  deleteExpense(id);
  renderAll();
}

function attachEventListeners() {
  if (listenersAttached) return;
  listenersAttached = true;

  document.getElementById("income-input").addEventListener("input", e => {
    setIncome(getSelectedMonth(), Number(e.target.value));
    renderAll();
  });

  document.getElementById("budget-input").addEventListener("input", e => {
    setBudget(getSelectedMonth(), Number(e.target.value));
    renderAll();
  });

  document.getElementById("expense-form").addEventListener("submit", e => {
    e.preventDefault();

    const amount = Number(document.getElementById("amount").value);
    const category = document.getElementById("category").value;
    const dateVal =
      document.getElementById("date").value || `${getSelectedMonth()}-01`;
    const note = document.getElementById("note").value;

    if (amount <= 0 || !category) return;

    let latestExpense = null;

    if (editingId) {
      updateExpense(editingId, {
        amount,
        category,
        date: dateVal,
        note
      });
      editingId = null;
    } else {
      latestExpense = {
        id: generateId(),
        amount,
        category,
        date: dateVal,
        note
      };
      addExpense(latestExpense);
    }

    e.target.reset();
    renderAll(latestExpense);
  });

  document.getElementById("goal-form").addEventListener("submit", e => {
    e.preventDefault();

    const name = document.getElementById("goal-name").value.trim();
    const targetAmount = Number(document.getElementById("goal-target").value);
    const targetMonthKey =
      document.getElementById("goal-target-month").value || null;

    if (!name || targetAmount <= 0) return;

    createSavingsGoal({
      name,
      targetAmount,
      startMonthKey: getSelectedMonth(),
      targetMonthKey
    });

    saveState();
    e.target.reset();
    renderSavingsGoals();
  });

  monthInput.addEventListener("change", () => {
  const monthKey = getSelectedMonth();

  // Reset alert state for the month
  alertState[monthKey] = {
    budget80: false,
    earlyBurn: false,
    largeExpenses: new Set(),
    category: {}
  }
  renderAll();
});
}

document
  .getElementById("clear-all-btn")
  .addEventListener("click", () => {
    const ok = confirm(
      "This will permanently delete all your expenses, income, budget, and savings data.\n\nThis cannot be undone.\n\nDo you want to continue?"
    );

    if (!ok) return;

    // 🔥 Clear all stored data
    expenses = [];
    monthlyIncome = {};
    monthlyBudget = {};
    savingsGoals = [];
    savingsLedger = {};
    alertState = {};

    // Clear localStorage
    localStorage.removeItem("expenses");
    localStorage.removeItem("monthlyIncome");
    localStorage.removeItem("monthlyBudget");
    localStorage.removeItem("savingsGoals");
    localStorage.removeItem("savingsLedger");
    localStorage.removeItem("savingsMode");

    // Reset mode to default
    savingsMode = "strict";

    // Re-render everything
    renderAll();
    updateToggleSwitch();

    alert("All data has been cleared.");
  });

  document
  .getElementById("clear-month-btn")
  .addEventListener("click", () => {
    const monthKey = getSelectedMonth();

    const ok = confirm(
      `This will delete all data for ${monthKey} only:\n\n` +
      `• Expenses\n• Income\n• Budget\n• Savings for this month\n\n` +
      `Other months will NOT be affected.\n\nContinue?`
    );

    if (!ok) return;

    // 🧹 Remove expenses of this month
    expenses = expenses.filter(e => !e.date.startsWith(monthKey));

    // 🧹 Remove income & budget of this month
    delete monthlyIncome[monthKey];
    delete monthlyBudget[monthKey];

    // 🧹 Remove savings allocations of this month
    delete savingsLedger[monthKey];

    // 🧹 Remove alert state of this month
    delete alertState[monthKey];

    // Persist
    saveState();

    // Re-render UI
    renderAll();

    alert(`Data for ${monthKey} has been cleared.`);
  });


function saveState() {
  localStorage.setItem("expenses", JSON.stringify(expenses));
  localStorage.setItem("monthlyIncome", JSON.stringify(monthlyIncome));
  localStorage.setItem("monthlyBudget", JSON.stringify(monthlyBudget));
  localStorage.setItem("savingsGoals", JSON.stringify(savingsGoals));
  localStorage.setItem("savingsLedger", JSON.stringify(savingsLedger));
}


const tooltipTriggerList = document.querySelectorAll('[data-bs-toggle="tooltip"]');
tooltipTriggerList.forEach(el => {
  new bootstrap.Tooltip(el);
});


// =====================
// REPORTING (LEVEL 7)
// =====================

//Monthly Summary Report
function generateMonthlySummary(monthKey) {
  const income = getIncome(monthKey);
  const expenses = sumExpenses(monthKey);
  const budget = getBudget(monthKey);
  const remaining = remainingBalance(monthKey);
  const budgetRem = budgetRemaining(monthKey);

  const savingsEntries = savingsLedger[monthKey] || [];
  const totalSaved = savingsEntries.reduce((s, e) => s + e.amount, 0);

  return {
    month: monthKey,
    income,
    expenses,
    remaining,
    budget,
    budgetRemaining: budgetRem,
    totalSaved,
    goals: savingsGoals.map(g => ({
      name: g.name,
      saved: g.savedAmount,
      target: g.targetAmount
    }))
  };
}

//Category Breakdown Report
function generateCategoryReport(monthKey) {
  const totals = getCategoryTotals(monthKey);
  const totalExpenses = sumExpenses(monthKey);

  return Object.entries(totals).map(([category, amount]) => ({
    category,
    amount,
    percentage:
      totalExpenses === 0
        ? 0
        : Math.round((amount / totalExpenses) * 100)
  }));
}

//Transaction Report
function generateTransactionReport(monthKey) {
  return getExpensesForMonth(monthKey)
    .slice()
    .sort((a, b) => new Date(a.date) - new Date(b.date))
    .map(e => ({
      date: e.date,
      amount: e.amount,
      category: e.category,
      note: e.note || ""
    }));
}

//Generic CSV helper
function exportToCSV(filename, rows) {
  if (!rows.length) return;

  const headers = Object.keys(rows[0]);
  const csv = [
    headers.join(","),
    ...rows.map(row =>
      headers.map(h => `"${row[h] ?? ""}"`).join(",")
    )
  ].join("\n");

  const blob = new Blob([csv], { type: "text/csv" });
  const url = URL.createObjectURL(blob);

  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();

  URL.revokeObjectURL(url);
}

//Export buttons (logic only)
function exportMonthlyReport() {
  const monthKey = getSelectedMonth();
  const summary = generateMonthlySummary(monthKey);
  exportToCSV(`summary-${monthKey}.csv`, [summary]);
}

function exportCategoryReport() {
  const monthKey = getSelectedMonth();
  const rows = generateCategoryReport(monthKey);
  exportToCSV(`categories-${monthKey}.csv`, rows);
}

function exportTransactionReport() {
  const monthKey = getSelectedMonth();
  const rows = generateTransactionReport(monthKey);
  exportToCSV(`transactions-${monthKey}.csv`, rows);
}

renderAll();          
renderSavingsGoals(); // 3️⃣ render goals
updateToggleSwitch(); // 5️⃣ UI polish
attachEventListeners();


function renderAll(latestExpense = null) {
  console.count("renderAll called");

  const monthKey = getSelectedMonth();

  // 🔥 Evaluate alerts ONCE
  const alerts = evaluateAlerts(monthKey, latestExpense);
  
  render();    
  renderDashboard();                 // main UI
  renderDashboardMeta(alerts);  // pass alerts
  renderBudgetProgress();
  renderCategoryPie();
  renderAlerts(alerts);         // same alerts
}



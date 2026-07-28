/**
 * Sohan Enterprise Ledger - Complete Offline PWA Logic
 * Pure JavaScript, 100% Offline, LocalStorage Data Persistence
 */

// Global State
const STATE_KEY_BALANCES = 'sohan_ledger_balances_v1';
const STATE_KEY_SNAPSHOTS = 'sohan_ledger_snapshots_v1';
const STATE_KEY_SETTINGS = 'sohan_ledger_settings_v1';

let balances = {
  investment: 100000,
  bkashAgent: 35000,
  bkashPersonal: 15000,
  nagad: 25000,
  cash: 30000
};

let snapshots = [];
let settings = {
  theme: 'light',
  pinEnabled: false,
  pinCode: '',
  lastAutoSnapshotDate: ''
};

let enteredPin = '';
let activeReportPeriod = 'today';
let activeReportChartType = 'bar';
let confirmCallback = null;

// Initialize App
document.addEventListener('DOMContentLoaded', () => {
  loadDataFromStorage();
  initTheme();
  initPinLock();
  initNavigation();
  initEventListeners();
  checkAutoDailySnapshot();
  updateUI();
  registerServiceWorker();
});

// Storage Management
function loadDataFromStorage() {
  try {
    const savedBalances = localStorage.getItem(STATE_KEY_BALANCES);
    if (savedBalances) balances = JSON.parse(savedBalances);

    const savedSnapshots = localStorage.getItem(STATE_KEY_SNAPSHOTS);
    if (savedSnapshots) snapshots = JSON.parse(savedSnapshots);

    const savedSettings = localStorage.getItem(STATE_KEY_SETTINGS);
    if (savedSettings) settings = JSON.parse(savedSettings);
  } catch (e) {
    console.error("Error loading localStorage data:", e);
    showToast("⚠️ Loaded default settings", "warning");
  }
}

function saveDataToStorage() {
  try {
    localStorage.setItem(STATE_KEY_BALANCES, JSON.stringify(balances));
    localStorage.setItem(STATE_KEY_SNAPSHOTS, JSON.stringify(snapshots));
    localStorage.setItem(STATE_KEY_SETTINGS, JSON.stringify(settings));
  } catch (e) {
    console.error("Error saving data to localStorage:", e);
    showToast("⚠️ Failed to save data locally", "error");
  }
}

function seedInitialSampleData() {
  const today = new Date();
  const sampleDates = [];
  for (let i = 4; i >= 0; i--) {
    const d = new Date(today);
    d.setDate(d.getDate() - i);
    sampleDates.push(d);
  }

  // Generate a few realistic historic snapshots
  snapshots = [
    {
      id: 'snap_' + (Date.now() - 400000000),
      timestamp: sampleDates[0].getTime(),
      dateStr: formatDateISO(sampleDates[0]),
      timeStr: '08:00 PM',
      investment: 100000,
      bkashAgent: 32000,
      bkashPersonal: 12000,
      nagad: 22000,
      cash: 33000,
      currentTotal: 99000,
      profitLoss: -1000, // Loss -1000
      note: 'Opening ledger setup'
    },
    {
      id: 'snap_' + (Date.now() - 300000000),
      timestamp: sampleDates[1].getTime(),
      dateStr: formatDateISO(sampleDates[1]),
      timeStr: '08:30 PM',
      investment: 100000,
      bkashAgent: 34000,
      bkashPersonal: 14000,
      nagad: 24000,
      cash: 29000,
      currentTotal: 101000,
      profitLoss: 1000, // Profit 1000
      note: 'Good agent commission day'
    },
    {
      id: 'snap_' + (Date.now() - 200000000),
      timestamp: sampleDates[2].getTime(),
      dateStr: formatDateISO(sampleDates[2]),
      timeStr: '09:00 PM',
      investment: 100000,
      bkashAgent: 35000,
      bkashPersonal: 15000,
      nagad: 25000,
      cash: 27000,
      currentTotal: 102000,
      profitLoss: 2000, // Profit 2000
      note: 'Steady daily balance'
    },
    {
      id: 'snap_' + (Date.now() - 100000000),
      timestamp: sampleDates[3].getTime(),
      dateStr: formatDateISO(sampleDates[3]),
      timeStr: '08:15 PM',
      investment: 100000,
      bkashAgent: 36000,
      bkashPersonal: 15000,
      nagad: 26000,
      cash: 26500,
      currentTotal: 103500,
      profitLoss: 3500, // Profit 3500
      note: 'High volume transactions'
    }
  ];

  saveDataToStorage();
}

// Calculations Engine
function calculateCurrentTotal(b = balances) {
  return (parseFloat(b.bkashAgent) || 0) +
         (parseFloat(b.bkashPersonal) || 0) +
         (parseFloat(b.nagad) || 0) +
         (parseFloat(b.cash) || 0);
}

function calculateProfitLoss(b = balances) {
  const currentTotal = calculateCurrentTotal(b);
  const investment = parseFloat(b.investment) || 0;
  return currentTotal - investment;
}

// Theme Engine
function initTheme() {
  if (settings.theme === 'dark') {
    document.body.classList.add('dark-theme');
    document.getElementById('themeIcon').textContent = '☀️';
  } else {
    document.body.classList.remove('dark-theme');
    document.getElementById('themeIcon').textContent = '🌙';
  }
}

function toggleTheme() {
  settings.theme = settings.theme === 'light' ? 'dark' : 'light';
  initTheme();
  saveDataToStorage();
  renderDashboardChart();
  renderReportChart();
}

// PIN Security
function initPinLock() {
  const overlay = document.getElementById('pinOverlay');
  const lockBtn = document.getElementById('lockAppBtn');
  const toggle = document.getElementById('pinEnableToggle');
  const configArea = document.getElementById('pinConfigArea');

  if (settings.pinEnabled && settings.pinCode) {
    overlay.classList.remove('hidden');
    lockBtn.classList.remove('hidden');
    toggle.checked = true;
    configArea.classList.remove('hidden');
  } else {
    overlay.classList.add('hidden');
    lockBtn.classList.add('hidden');
    toggle.checked = false;
    configArea.classList.add('hidden');
  }

  enteredPin = '';
  updatePinDots();
}

function handlePinKey(key) {
  const errorEl = document.getElementById('pinError');
  errorEl.classList.add('hidden');

  if (key === 'clear') {
    enteredPin = '';
  } else if (key === 'back') {
    enteredPin = enteredPin.slice(0, -1);
  } else if (enteredPin.length < 4) {
    enteredPin += key;
  }

  updatePinDots();

  if (enteredPin.length === 4) {
    setTimeout(() => {
      if (enteredPin === settings.pinCode) {
        document.getElementById('pinOverlay').classList.add('hidden');
        enteredPin = '';
        updatePinDots();
        showToast("🔓 Unlocked successfully", "success");
      } else {
        errorEl.classList.remove('hidden');
        enteredPin = '';
        updatePinDots();
      }
    }, 150);
  }
}

function updatePinDots() {
  const dots = document.querySelectorAll('#pinDots .dot');
  dots.forEach((dot, index) => {
    if (index < enteredPin.length) {
      dot.classList.add('filled');
    } else {
      dot.classList.remove('filled');
    }
  });
}

// Navigation Tabs
function initNavigation() {
  const tabBtns = document.querySelectorAll('.tab-btn');
  tabBtns.forEach(btn => {
    btn.addEventListener('click', () => {
      const tabTarget = btn.getAttribute('data-tab');
      
      tabBtns.forEach(b => b.classList.remove('active'));
      btn.classList.add('active');

      document.querySelectorAll('.tab-page').forEach(page => {
        page.classList.add('hidden');
      });

      const activePage = document.getElementById(`tab-${tabTarget}`);
      if (activePage) {
        activePage.classList.remove('hidden');
      }

      if (tabTarget === 'dashboard') {
        renderDashboardChart();
      } else if (tabTarget === 'reports') {
        renderReportsTab();
      } else if (tabTarget === 'history') {
        renderHistoryList();
      }
    });
  });
}

// Automatic Daily Snapshot
function checkAutoDailySnapshot() {
  const todayStr = formatDateISO(new Date());
  const existingSnap = snapshots.find(s => s.dateStr === todayStr);

  const statusText = document.getElementById('snapshotStatusText');
  const btn = document.getElementById('saveSnapshotBtn');

  if (existingSnap) {
    if (statusText) statusText.textContent = `Today's snapshot saved (${existingSnap.timeStr})`;
    if (btn) btn.textContent = '🔄 Update Today\'s Snapshot';
  } else {
    if (statusText) statusText.textContent = 'Not saved yet for today';
    if (btn) btn.textContent = '📷 Take Daily Snapshot';
  }
}

// UI Updating Engine
function updateUI() {
  const currentTotal = calculateCurrentTotal();
  const profitLoss = calculateProfitLoss();

  // Status Card Banner
  const statusCard = document.getElementById('statusCard');
  const statusBadge = document.getElementById('statusBadge');
  const plValue = document.getElementById('profitLossValue');

  // Format profit/loss string with BDT currency symbol
  const formattedPL = Math.abs(profitLoss).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) + ' ৳';

  plValue.textContent = (profitLoss >= 0 ? '+ ' : '- ') + formattedPL;

  if (profitLoss > 0) {
    statusCard.className = 'status-card profit';
    statusBadge.className = 'status-badge profit';
    statusBadge.innerHTML = '🟢 Profit (लाभ)';
  } else if (profitLoss < 0) {
    statusCard.className = 'status-card loss';
    statusBadge.className = 'status-badge loss';
    statusBadge.innerHTML = '🔴 Loss (লস)';
  } else {
    statusCard.className = 'status-card neutral';
    statusBadge.className = 'status-badge neutral';
    statusBadge.innerHTML = '⚪ Balanced (0 ৳)';
  }

  // Dashboard Stat Pills & Card Amounts
  document.getElementById('dashTotalInvest').textContent = formatCurrency(balances.investment);
  document.getElementById('dashCurrentTotal').textContent = formatCurrency(currentTotal);

  document.getElementById('valBkashAgent').textContent = formatCurrency(balances.bkashAgent);
  document.getElementById('valBkashPersonal').textContent = formatCurrency(balances.bkashPersonal);
  document.getElementById('valNagad').textContent = formatCurrency(balances.nagad);
  document.getElementById('valCash').textContent = formatCurrency(balances.cash);
  document.getElementById('valInvestment').textContent = formatCurrency(balances.investment);

  // Progress Bar Visual Fills
  const totalForBars = currentTotal > 0 ? currentTotal : 1;
  document.getElementById('barBkashAgent').style.width = Math.min(100, (balances.bkashAgent / totalForBars) * 100) + '%';
  document.getElementById('barBkashPersonal').style.width = Math.min(100, (balances.bkashPersonal / totalForBars) * 100) + '%';
  document.getElementById('barNagad').style.width = Math.min(100, (balances.nagad / totalForBars) * 100) + '%';
  document.getElementById('barCash').style.width = Math.min(100, (balances.cash / totalForBars) * 100) + '%';

  checkAutoDailySnapshot();
  renderDashboardChart();
}

// Event Listeners Initialization
function initEventListeners() {
  // Theme Toggle
  document.getElementById('themeToggleBtn').addEventListener('click', toggleTheme);

  // Lock App
  document.getElementById('lockAppBtn').addEventListener('click', () => {
    if (settings.pinEnabled) {
      document.getElementById('pinOverlay').classList.remove('hidden');
      enteredPin = '';
      updatePinDots();
    }
  });

  // PIN Keypad clicks
  document.querySelectorAll('.key-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      const key = btn.getAttribute('data-key');
      handlePinKey(key);
    });
  });

  // Edit Balances Modal Triggers
  document.getElementById('quickUpdateBtn').addEventListener('click', openEditModal);
  document.querySelectorAll('.edit-single-btn').forEach(btn => {
    btn.addEventListener('click', openEditModal);
  });

  document.getElementById('closeEditModalBtn').addEventListener('click', closeEditModal);
  document.getElementById('cancelEditModalBtn').addEventListener('click', closeEditModal);
  document.getElementById('saveBalancesModalBtn').addEventListener('click', saveBalancesFromModal);

  // Real-time calculation feedback inside modal
  const formInputs = ['inputInvestment', 'inputBkashAgent', 'inputBkashPersonal', 'inputNagad', 'inputCash'];
  formInputs.forEach(id => {
    document.getElementById(id).addEventListener('input', updateModalLivePreview);
  });

  // Daily Snapshot Triggers
  document.getElementById('saveSnapshotBtn').addEventListener('click', openSnapshotModal);
  document.getElementById('closeSnapshotModalBtn').addEventListener('click', closeSnapshotModal);
  document.getElementById('cancelSnapshotModalBtn').addEventListener('click', closeSnapshotModal);
  document.getElementById('confirmSnapshotBtn').addEventListener('click', confirmTakeSnapshot);

  // Report Period Filter Chips
  document.querySelectorAll('.filter-chip').forEach(chip => {
    chip.addEventListener('click', () => {
      document.querySelectorAll('.filter-chip').forEach(c => c.classList.remove('active'));
      chip.classList.add('active');
      activeReportPeriod = chip.getAttribute('data-period');
      renderReportsTab();
    });
  });

  // Report Chart Type Toggle
  document.getElementById('chartTypeBar').addEventListener('click', () => {
    document.getElementById('chartTypeBar').classList.add('active');
    document.getElementById('chartTypeLine').classList.remove('active');
    activeReportChartType = 'bar';
    renderReportChart();
  });

  document.getElementById('chartTypeLine').addEventListener('click', () => {
    document.getElementById('chartTypeLine').classList.add('active');
    document.getElementById('chartTypeBar').classList.remove('active');
    activeReportChartType = 'line';
    renderReportChart();
  });

  // Search History Inputs
  document.getElementById('historySearchInput').addEventListener('input', (e) => {
    const clearBtn = document.getElementById('clearSearchBtn');
    if (e.target.value) {
      clearBtn.classList.remove('hidden');
    } else {
      clearBtn.classList.add('hidden');
    }
    renderHistoryList();
  });

  document.getElementById('clearSearchBtn').addEventListener('click', () => {
    const input = document.getElementById('historySearchInput');
    input.value = '';
    document.getElementById('clearSearchBtn').classList.add('hidden');
    renderHistoryList();
  });

  document.getElementById('historyStatusFilter').addEventListener('change', renderHistoryList);

  // Clear History
  document.getElementById('clearHistoryBtn').addEventListener('click', () => {
    openConfirmModal(
      "Clear Snapshot History?",
      "Are you sure you want to delete all snapshot records? This action cannot be undone.",
      () => {
        snapshots = [];
        saveDataToStorage();
        renderHistoryList();
        renderReportsTab();
        updateUI();
        showToast("🗑️ History cleared", "info");
      }
    );
  });

  // Export JSON Backup
  document.getElementById('exportJsonBtn').addEventListener('click', exportJsonBackup);

  // Import JSON Restore
  document.getElementById('importJsonInput').addEventListener('change', handleImportJson);

  // PIN Settings Toggle & Modal
  document.getElementById('pinEnableToggle').addEventListener('change', (e) => {
    if (e.target.checked) {
      openSetPinModal("Set 4-Digit Security PIN");
    } else {
      settings.pinEnabled = false;
      settings.pinCode = '';
      saveDataToStorage();
      initPinLock();
      showToast("🔒 PIN Lock disabled", "info");
    }
  });

  document.getElementById('changePinBtn').addEventListener('click', () => {
    openSetPinModal("Change 4-Digit PIN");
  });

  document.getElementById('closeSetPinModalBtn').addEventListener('click', closeSetPinModal);
  document.getElementById('cancelSetPinBtn').addEventListener('click', closeSetPinModal);
  document.getElementById('savePinBtn').addEventListener('click', saveNewPinCode);

  // Factory Reset App
  document.getElementById('resetAppBtn').addEventListener('click', () => {
    openConfirmModal(
      "Reset Everything?",
      "This will wipe all balances, snapshot history, and settings back to factory default.",
      () => {
        localStorage.clear();
        balances = { investment: 0, bkashAgent: 0, bkashPersonal: 0, nagad: 0, cash: 0 };
        snapshots = [];
        settings = { theme: 'light', pinEnabled: false, pinCode: '', lastAutoSnapshotDate: '' };
        saveDataToStorage();
        initTheme();
        initPinLock();
        updateUI();
        showToast("⚠️ App reset to factory defaults", "info");
      }
    );
  });

  // Confirm Modal Handlers
  document.getElementById('closeConfirmModalBtn').addEventListener('click', closeConfirmModal);
  document.getElementById('confirmCancelBtn').addEventListener('click', closeConfirmModal);
  document.getElementById('confirmOkBtn').addEventListener('click', () => {
    if (confirmCallback) confirmCallback();
    closeConfirmModal();
  });
}

// Edit Balances Modal Functions
function openEditModal() {
  document.getElementById('inputInvestment').value = balances.investment;
  document.getElementById('inputBkashAgent').value = balances.bkashAgent;
  document.getElementById('inputBkashPersonal').value = balances.bkashPersonal;
  document.getElementById('inputNagad').value = balances.nagad;
  document.getElementById('inputCash').value = balances.cash;

  updateModalLivePreview();
  document.getElementById('editBalancesModal').classList.remove('hidden');
}

function closeEditModal() {
  document.getElementById('editBalancesModal').classList.add('hidden');
}

function updateModalLivePreview() {
  const invest = parseFloat(document.getElementById('inputInvestment').value) || 0;
  const bAgent = parseFloat(document.getElementById('inputBkashAgent').value) || 0;
  const bPers = parseFloat(document.getElementById('inputBkashPersonal').value) || 0;
  const nagad = parseFloat(document.getElementById('inputNagad').value) || 0;
  const cash = parseFloat(document.getElementById('inputCash').value) || 0;

  const total = bAgent + bPers + nagad + cash;
  const pl = total - invest;

  document.getElementById('modalCalcTotal').textContent = formatCurrency(total);
  
  const plEl = document.getElementById('modalCalcPL');
  plEl.textContent = (pl >= 0 ? '+ ' : '- ') + formatCurrency(Math.abs(pl));

  if (pl > 0) {
    plEl.className = 'text-success';
  } else if (pl < 0) {
    plEl.className = 'text-danger';
  } else {
    plEl.className = 'text-neutral';
  }
}

function saveBalancesFromModal() {
  const invest = parseFloat(document.getElementById('inputInvestment').value) || 0;
  const bAgent = parseFloat(document.getElementById('inputBkashAgent').value) || 0;
  const bPers = parseFloat(document.getElementById('inputBkashPersonal').value) || 0;
  const nagad = parseFloat(document.getElementById('inputNagad').value) || 0;
  const cash = parseFloat(document.getElementById('inputCash').value) || 0;

  balances.investment = invest;
  balances.bkashAgent = bAgent;
  balances.bkashPersonal = bPers;
  balances.nagad = nagad;
  balances.cash = cash;

  saveDataToStorage();
  updateUI();
  closeEditModal();
  showToast("✅ Balances updated successfully", "success");
}

// Snapshot Functions
function openSnapshotModal() {
  const now = new Date();
  const currentTotal = calculateCurrentTotal();
  const profitLoss = calculateProfitLoss();

  document.getElementById('snapModalDate').textContent = `${formatDateISO(now)} (${formatTimeStr(now)})`;
  document.getElementById('snapModalInvestment').textContent = formatCurrency(balances.investment);
  document.getElementById('snapModalTotal').textContent = formatCurrency(currentTotal);

  const plEl = document.getElementById('snapModalPL');
  plEl.textContent = (profitLoss >= 0 ? '+ ' : '- ') + formatCurrency(Math.abs(profitLoss));
  plEl.className = profitLoss > 0 ? 'text-success' : profitLoss < 0 ? 'text-danger' : 'text-neutral';

  document.getElementById('snapshotNoteInput').value = '';
  document.getElementById('snapshotModal').classList.remove('hidden');
}

function closeSnapshotModal() {
  document.getElementById('snapshotModal').classList.add('hidden');
}

function confirmTakeSnapshot() {
  const now = new Date();
  const dateStr = formatDateISO(now);
  const timeStr = formatTimeStr(now);
  const currentTotal = calculateCurrentTotal();
  const profitLoss = calculateProfitLoss();
  const note = document.getElementById('snapshotNoteInput').value.trim();

  // Check if today already has a snapshot, update it or add new
  const existingIndex = snapshots.findIndex(s => s.dateStr === dateStr);

  const newSnap = {
    id: 'snap_' + Date.now(),
    timestamp: now.getTime(),
    dateStr: dateStr,
    timeStr: timeStr,
    investment: balances.investment,
    bkashAgent: balances.bkashAgent,
    bkashPersonal: balances.bkashPersonal,
    nagad: balances.nagad,
    cash: balances.cash,
    currentTotal: currentTotal,
    profitLoss: profitLoss,
    note: note || (profitLoss >= 0 ? 'Daily profit recorded' : 'Daily loss recorded')
  };

  if (existingIndex !== -1) {
    snapshots[existingIndex] = newSnap;
    showToast("🔄 Updated today's snapshot", "success");
  } else {
    snapshots.unshift(newSnap);
    showToast("📷 Daily snapshot saved!", "success");
  }

  saveDataToStorage();
  closeSnapshotModal();
  updateUI();
}

// Reports Logic
function getSnapshotsForPeriod(period) {
  const now = new Date();
  const todayStr = formatDateISO(now);

  return snapshots.filter(snap => {
    const snapDate = new Date(snap.timestamp || snap.dateStr);

    if (period === 'today') {
      return snap.dateStr === todayStr;
    } else if (period === 'yesterday') {
      const yest = new Date(now);
      yest.setDate(yest.getDate() - 1);
      return snap.dateStr === formatDateISO(yest);
    } else if (period === 'last7') {
      const diffDays = (now - snapDate) / (1000 * 60 * 60 * 24);
      return diffDays <= 7 && diffDays >= 0;
    } else if (period === 'thisMonth') {
      return snapDate.getMonth() === now.getMonth() && snapDate.getFullYear() === now.getFullYear();
    } else if (period === 'lastMonth') {
      const lastM = new Date(now.getFullYear(), now.getMonth() - 1, 1);
      return snapDate.getMonth() === lastM.getMonth() && snapDate.getFullYear() === lastM.getFullYear();
    }
    return true;
  });
}

function renderReportsTab() {
  const filtered = getSnapshotsForPeriod(activeReportPeriod);

  const netPL = filtered.reduce((acc, curr) => acc + curr.profitLoss, 0);
  const avgPL = filtered.length > 0 ? netPL / filtered.length : 0;
  const maxProfit = filtered.length > 0 ? Math.max(...filtered.map(s => s.profitLoss)) : 0;

  document.getElementById('reportNetPL').textContent = (netPL >= 0 ? '+ ' : '- ') + formatCurrency(Math.abs(netPL));
  document.getElementById('reportAvgPL').textContent = (avgPL >= 0 ? '+ ' : '- ') + formatCurrency(Math.abs(avgPL));
  document.getElementById('reportCount').textContent = filtered.length;
  document.getElementById('reportMaxProfit').textContent = formatCurrency(Math.max(0, maxProfit));

  const badge = document.getElementById('reportPLBadge');
  if (netPL > 0) {
    badge.className = 'badge-status profit';
    badge.textContent = 'Profit (लाभ)';
  } else if (netPL < 0) {
    badge.className = 'badge-status loss';
    badge.textContent = 'Loss (লস)';
  } else {
    badge.className = 'badge-status';
    badge.textContent = 'Balanced';
  }

  // Render period history list
  const listEl = document.getElementById('reportList');
  if (filtered.length === 0) {
    listEl.innerHTML = `<div class="empty-state">কোনো হিসাব পাওয়া যায়নি</div>`;
  } else {
    listEl.innerHTML = filtered.map(snap => renderSnapshotCardHTML(snap, false)).join('');
  }

  renderReportChart();
}

// History List Rendering
function renderHistoryList() {
  const container = document.getElementById('historyListContainer');
  const query = document.getElementById('historySearchInput').value.toLowerCase().trim();
  const statusFilter = document.getElementById('historyStatusFilter').value;

  let filtered = [...snapshots];

  if (statusFilter === 'profit') {
    filtered = filtered.filter(s => s.profitLoss > 0);
  } else if (statusFilter === 'loss') {
    filtered = filtered.filter(s => s.profitLoss < 0);
  }

  if (query) {
    filtered = filtered.filter(s => {
      const matchDate = s.dateStr.includes(query);
      const matchNote = s.note && s.note.toLowerCase().includes(query);
      const matchStatus = (query.includes('लाभ') || query.includes('profit')) ? s.profitLoss > 0 :
                          (query.includes('লস') || query.includes('loss')) ? s.profitLoss < 0 : false;
      return matchDate || matchNote || matchStatus;
    });
  }

  if (filtered.length === 0) {
    container.innerHTML = `<div class="empty-state">কোনো হিসাব পাওয়া যায়নি</div>`;
    return;
  }

  container.innerHTML = filtered.map(snap => renderSnapshotCardHTML(snap, true)).join('');

  // Attach delete click listeners
  container.querySelectorAll('.delete-hist-btn').forEach(btn => {
    btn.addEventListener('click', (e) => {
      const id = btn.getAttribute('data-id');
      deleteSnapshotById(id);
    });
  });
}

function renderSnapshotCardHTML(snap, allowDelete = true) {
  const isProfit = snap.profitLoss > 0;
  const isLoss = snap.profitLoss < 0;
  const badgeClass = isProfit ? 'profit' : isLoss ? 'loss' : 'neutral';
  const badgeText = isProfit ? 'Profit (लाभ)' : isLoss ? 'Loss (লস)' : '0 ৳';

  return `
    <div class="history-card">
      <div class="history-card-top">
        <div>
          <span class="history-date">📅 ${snap.dateStr}</span>
          <span class="sub-text" style="margin-left:6px;">${snap.timeStr || ''}</span>
        </div>
        <span class="history-badge ${badgeClass}">${badgeText}</span>
      </div>

      <div class="history-details-grid">
        <div class="detail-item">
          <span class="detail-label">bKash Agent:</span>
          <span class="detail-val">${formatCurrency(snap.bkashAgent)}</span>
        </div>
        <div class="detail-item">
          <span class="detail-label">Personal bKash:</span>
          <span class="detail-val">${formatCurrency(snap.bkashPersonal)}</span>
        </div>
        <div class="detail-item">
          <span class="detail-label">Nagad:</span>
          <span class="detail-val">${formatCurrency(snap.nagad)}</span>
        </div>
        <div class="detail-item">
          <span class="detail-label">Cash:</span>
          <span class="detail-val">${formatCurrency(snap.cash)}</span>
        </div>
        <div class="detail-item">
          <span class="detail-label">Investment:</span>
          <span class="detail-val">${formatCurrency(snap.investment)}</span>
        </div>
        <div class="detail-item">
          <span class="detail-label">Current Total:</span>
          <span class="detail-val">${formatCurrency(snap.currentTotal)}</span>
        </div>
      </div>

      <div class="history-footer-row">
        <span class="history-note">📝 ${escapeHtml(snap.note || 'No note')}</span>
        ${allowDelete ? `<button class="delete-hist-btn" data-id="${snap.id}">🗑️ Delete</button>` : ''}
      </div>
    </div>
  `;
}

function deleteSnapshotById(id) {
  openConfirmModal(
    "Delete Snapshot?",
    "Are you sure you want to remove this snapshot record?",
    () => {
      snapshots = snapshots.filter(s => String(s.id) !== String(id));
      saveDataToStorage();
      renderHistoryList();
      renderReportsTab();
      updateUI();
      showToast("🗑️ Snapshot deleted", "info");
    }
  );
}

// Pure Offline Canvas Charting Engine
function renderDashboardChart() {
  const canvas = document.getElementById('dashboardChart');
  if (!canvas) return;

  // Use last 7 snapshots ordered chronologically
  const recentSnaps = [...snapshots].reverse().slice(-7);
  drawCanvasChart(canvas, recentSnaps, 'line');
}

function renderReportChart() {
  const canvas = document.getElementById('reportChart');
  if (!canvas) return;

  const filteredSnaps = getSnapshotsForPeriod(activeReportPeriod).reverse();
  drawCanvasChart(canvas, filteredSnaps, activeReportChartType);
}

function drawCanvasChart(canvas, dataList, type = 'line') {
  const ctx = canvas.getContext('2d');
  const rect = canvas.getBoundingClientRect();
  const width = rect.width || 300;
  const height = 200;

  canvas.width = width * window.devicePixelRatio;
  canvas.height = height * window.devicePixelRatio;
  ctx.scale(window.devicePixelRatio, window.devicePixelRatio);

  ctx.clearRect(0, 0, width, height);

  const isDark = document.body.classList.contains('dark-theme');
  const textColor = isDark ? '#94a3b8' : '#64748b';
  const gridColor = isDark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.06)';

  if (dataList.length === 0) {
    ctx.fillStyle = textColor;
    ctx.font = '13px sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText('No snapshot data to display chart', width / 2, height / 2);
    return;
  }

  const padding = { top: 20, right: 20, bottom: 35, left: 55 };
  const chartWidth = width - padding.left - padding.right;
  const chartHeight = height - padding.top - padding.bottom;

  const plValues = dataList.map(d => d.profitLoss);
  let maxVal = Math.max(...plValues, 1000);
  let minVal = Math.min(...plValues, -1000);

  // Add buffer
  maxVal = Math.ceil(maxVal * 1.1);
  minVal = Math.floor(minVal * 1.1);
  if (minVal > 0) minVal = 0;

  const valRange = (maxVal - minVal) || 1;

  // Draw Grid Lines
  const gridSteps = 4;
  ctx.strokeStyle = gridColor;
  ctx.lineWidth = 1;
  ctx.fillStyle = textColor;
  ctx.font = '10px sans-serif';
  ctx.textAlign = 'right';

  for (let i = 0; i <= gridSteps; i++) {
    const yVal = minVal + (valRange * (i / gridSteps));
    const yPos = height - padding.bottom - (chartHeight * (i / gridSteps));

    ctx.beginPath();
    ctx.moveTo(padding.left, yPos);
    ctx.lineTo(width - padding.right, yPos);
    ctx.stroke();

    ctx.fillText(formatShortNumber(yVal), padding.left - 6, yPos + 3);
  }

  // Draw Zero Line if within range
  if (minVal <= 0 && maxVal >= 0) {
    const zeroY = height - padding.bottom - (chartHeight * ((0 - minVal) / valRange));
    ctx.strokeStyle = isDark ? '#475569' : '#cbd5e1';
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.moveTo(padding.left, zeroY);
    ctx.lineTo(width - padding.right, zeroY);
    ctx.stroke();
  }

  const stepX = dataList.length > 1 ? chartWidth / (dataList.length - 1) : chartWidth / 2;

  if (type === 'bar') {
    const barWidth = Math.min(28, (chartWidth / dataList.length) * 0.6);

    dataList.forEach((item, index) => {
      const x = padding.left + (dataList.length === 1 ? chartWidth / 2 : index * (chartWidth / (dataList.length - 1)));
      const zeroY = height - padding.bottom - (chartHeight * ((0 - minVal) / valRange));
      const valY = height - padding.bottom - (chartHeight * ((item.profitLoss - minVal) / valRange));

      ctx.fillStyle = item.profitLoss >= 0 ? '#16a34a' : '#dc2626';
      
      const barY = Math.min(zeroY, valY);
      const barH = Math.max(2, Math.abs(zeroY - valY));

      ctx.beginPath();
      ctx.roundRect ? ctx.roundRect(x - barWidth/2, barY, barWidth, barH, 4) : ctx.rect(x - barWidth/2, barY, barWidth, barH);
      ctx.fill();

      // Date Label
      ctx.fillStyle = textColor;
      ctx.font = '10px sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText(item.dateStr.slice(5), x, height - 12);
    });
  } else {
    // Line Chart
    ctx.beginPath();
    const points = [];

    dataList.forEach((item, index) => {
      const x = padding.left + (dataList.length === 1 ? chartWidth / 2 : index * stepX);
      const y = height - padding.bottom - (chartHeight * ((item.profitLoss - minVal) / valRange));
      points.push({ x, y, val: item.profitLoss, date: item.dateStr });

      if (index === 0) ctx.moveTo(x, y);
      else ctx.lineTo(x, y);
    });

    ctx.strokeStyle = '#4f46e5';
    ctx.lineWidth = 2.5;
    ctx.stroke();

    // Draw Points
    points.forEach(pt => {
      ctx.beginPath();
      ctx.arc(pt.x, pt.y, 5, 0, Math.PI * 2);
      ctx.fillStyle = pt.val >= 0 ? '#16a34a' : '#dc2626';
      ctx.fill();
      ctx.strokeStyle = '#ffffff';
      ctx.lineWidth = 1.5;
      ctx.stroke();

      // Label
      ctx.fillStyle = textColor;
      ctx.font = '10px sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText(pt.date.slice(5), pt.x, height - 12);
    });
  }
}

// JSON Export & Restore
function exportJsonBackup() {
  const data = {
    appName: "Sohan Enterprise Ledger",
    exportDate: new Date().toISOString(),
    version: 1.0,
    balances: balances,
    snapshots: snapshots,
    settings: settings
  };

  const jsonStr = JSON.stringify(data, null, 2);
  const blob = new Blob([jsonStr], { type: 'application/json' });
  const url = URL.createObjectURL(blob);

  const a = document.createElement('a');
  a.href = url;
  a.download = `sohan_ledger_backup_${formatDateISO(new Date())}.json`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);

  showToast("📥 JSON Backup downloaded", "success");
}

function handleImportJson(e) {
  const file = e.target.files[0];
  if (!file) return;

  const reader = new FileReader();
  reader.onload = (event) => {
    try {
      const parsed = JSON.parse(event.target.result);
      if (!parsed.balances || !parsed.snapshots) {
        throw new Error("Invalid ledger backup format");
      }

      openConfirmModal(
        "Restore Ledger Data?",
        `Found backup with ${parsed.snapshots.length} snapshot records. This will replace current local data. Continue?`,
        () => {
          balances = parsed.balances;
          snapshots = parsed.snapshots;
          if (parsed.settings) settings = parsed.settings;

          saveDataToStorage();
          initTheme();
          initPinLock();
          updateUI();
          renderHistoryList();
          renderReportsTab();

          showToast("📤 Data restored successfully!", "success");
        }
      );
    } catch (err) {
      showToast("❌ Invalid JSON backup file", "error");
    }
  };

  reader.readAsText(file);
  e.target.value = ''; // Reset file input
}

// Set PIN Modal Functions
function openSetPinModal(title) {
  document.getElementById('setPinTitle').textContent = title;
  document.getElementById('newPinInput').value = '';
  document.getElementById('confirmPinInput').value = '';
  document.getElementById('setPinError').classList.add('hidden');
  document.getElementById('setPinModal').classList.remove('hidden');
}

function closeSetPinModal() {
  document.getElementById('setPinModal').classList.add('hidden');
}

function saveNewPinCode() {
  const pin1 = document.getElementById('newPinInput').value.trim();
  const pin2 = document.getElementById('confirmPinInput').value.trim();
  const errorEl = document.getElementById('setPinError');

  if (pin1.length !== 4 || !/^\d+$/.test(pin1)) {
    errorEl.textContent = "PIN must be exactly 4 digits";
    errorEl.classList.remove('hidden');
    return;
  }

  if (pin1 !== pin2) {
    errorEl.textContent = "PINs do not match";
    errorEl.classList.remove('hidden');
    return;
  }

  settings.pinEnabled = true;
  settings.pinCode = pin1;
  saveDataToStorage();
  initPinLock();
  closeSetPinModal();
  showToast("🔐 PIN Lock saved & enabled", "success");
}

// Confirmation Dialog Modal
function openConfirmModal(title, message, callback) {
  document.getElementById('confirmTitle').textContent = title;
  document.getElementById('confirmMessage').textContent = message;
  confirmCallback = callback;
  document.getElementById('confirmModal').classList.remove('hidden');
}

function closeConfirmModal() {
  document.getElementById('confirmModal').classList.add('hidden');
  confirmCallback = null;
}

// Toast Notification Engine
function showToast(message, type = 'info') {
  const container = document.getElementById('toastContainer');
  if (!container) return;

  const toast = document.createElement('div');
  toast.className = 'toast';
  toast.textContent = message;

  container.appendChild(toast);

  setTimeout(() => {
    toast.style.opacity = '0';
    toast.style.transform = 'translateY(10px)';
    setTimeout(() => {
      if (toast.parentNode) toast.parentNode.removeChild(toast);
    }, 300);
  }, 2500);
}

// Utility Functions
function formatCurrency(amount) {
  const num = parseFloat(amount) || 0;
  return num.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) + ' ৳';
}

function formatDateISO(d) {
  const date = new Date(d);
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

function formatTimeStr(d) {
  return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
}

function formatShortNumber(num) {
  if (Math.abs(num) >= 100000) return (num / 100000).toFixed(1) + 'L';
  if (Math.abs(num) >= 1000) return (num / 1000).toFixed(1) + 'k';
  return Math.round(num);
}

function escapeHtml(str) {
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

// PWA Service Worker Registration
function registerServiceWorker() {
  if ('serviceWorker' in navigator) {
    navigator.serviceWorker.register('service-worker.js')
      .then(reg => {
        console.log('PWA ServiceWorker registered:', reg.scope);
        const statusEl = document.getElementById('pwaStatus');
        if (statusEl) statusEl.textContent = 'Active (Offline Ready)';
      })
      .catch(err => {
        console.log('ServiceWorker registration failed:', err);
      });
  }
}

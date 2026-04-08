/* ═══════════════════════════════════════════════════════════════
   UI — Advanced rendering, particles, modals, forms, animations
   ═══════════════════════════════════════════════════════════════ */

const UI = (() => {
  const $ = (sel) => document.querySelector(sel);
  const $$ = (sel) => document.querySelectorAll(sel);

  const els = {
    // Auth Screens
    screenWelcome: $('#screenWelcome'),
    screenAuth: $('#screenAuth'),
    btnWelcomeSignIn: $('#btnWelcomeSignIn'),
    
    authTitle: $('#authTitle'),
    authSubtitle: $('#authSubtitle'),
    authForm: $('#authForm'),
    authEmail: $('#authEmail'),
    authPassword: $('#authPassword'),
    authRemember: $('#authRemember'),
    btnAuthSubmit: $('#btnAuthSubmit'),
    btnAuthBack: $('#btnAuthBack'),

    // App Screens
    screenWorkerSelect: $('#screenWorkerSelect'),
    workerGrid: $('#workerGrid'),
    selectGreeting: $('#selectGreeting'),
    btnLogout: $('#btnLogout'),
    
    screenDashboard: $('#screenDashboard'),
    btnBack: $('#btnBack'),
    btnHistory: $('#btnHistory'),
    btnHistoryBack: $('#btnHistoryBack'),
    dashWorkerName: $('#dashWorkerName'),
    dashStatus: $('#dashStatus'),
    statusPill: $('#statusPill'),
    liveClock: $('#liveClock'),
    liveDate: $('#liveDate'),
    shiftTimer: $('#shiftTimer'),
    shiftDuration: $('#shiftDuration'),
    shiftSince: $('#shiftSince'),
    shiftProgressBar: $('#shiftProgressBar'),
    btnClock: $('#btnClock'),
    clockBtnText: $('#clockBtnText'),
    
    statToday: $('#statToday'),
    statWeek: $('#statWeek'),
    statShifts: $('#statShifts'),
    statTotalHours: $('#statTotalHours'),
    
    screenHistory: $('#screenHistory'),
    historyList: $('#historyList'),
    
    clockOutModal: $('#clockOutModal'),
    btnModalClose: $('#btnModalClose'),
    clockOutForm: $('#clockOutForm'),
    modalClockIn: $('#modalClockIn'),
    modalDuration: $('#modalDuration'),
    starRating: $('#starRating'),
    btnSubmitClockOut: $('#btnSubmitClockOut'),

    // Payroll Elements
    statWorkingDays: $('#statWorkingDays'),
    statLeaveDays: $('#statLeaveDays'),
    statCutoff: $('#statCutoff'),
    statTakeHome: $('#statTakeHome'),

    // Add Profile Modal
    modalAddProfile: $('#modalAddProfile'),
    formAddProfile: $('#formAddProfile'),
    btnCloseProfileModal: $('#btnCloseProfileModal'),
    newProfileName: $('#newProfileName'),
    newProfileRole: $('#newProfileRole'),
    
    // Leave Elements
    modalLeave: $('#modalLeave'),
    formLeave: $('#formLeave'),
    btnCloseLeaveModal: $('#btnCloseLeaveModal'),
    btnRequestLeave: $('#btnRequestLeave'),
    leaveReason: $('#leaveReason'),
    leaveDate: $('#leaveDate'),
    btnSubmitLeave: $('#btnSubmitLeave'),

    toastContainer: $('#toastContainer'),
    selectLiveClock: $('#selectLiveClock'),
    particleCanvas: $('#particleCanvas'),
  };

  // ─── Particle System ─────────────────────────────────────
  function initParticles() {
    const canvas = els.particleCanvas;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    let particles = [];
    let w, h;

    function resize() {
      w = canvas.width = window.innerWidth;
      h = canvas.height = window.innerHeight;
    }
    resize();
    window.addEventListener('resize', resize);

    class Particle {
      constructor() { this.reset(); }
      reset() {
        this.x = Math.random() * w;
        this.y = Math.random() * h;
        this.vx = (Math.random() - 0.5) * 0.3;
        this.vy = (Math.random() - 0.5) * 0.3;
        this.r = Math.random() * 1.5 + 0.5;
        this.o = Math.random() * 0.4 + 0.05;
      }
      update() {
        this.x += this.vx;
        this.y += this.vy;
        if (this.x < 0 || this.x > w || this.y < 0 || this.y > h) this.reset();
      }
      draw() {
        ctx.beginPath();
        ctx.arc(this.x, this.y, this.r, 0, Math.PI * 2);
        ctx.fillStyle = `rgba(61, 142, 185, ${this.o})`;
        ctx.fill();
      }
    }

    for (let i = 0; i < 60; i++) particles.push(new Particle());

    function animate() {
      ctx.clearRect(0, 0, w, h);
      particles.forEach((p) => { p.update(); p.draw(); });
      requestAnimationFrame(animate);
    }
    animate();
  }

  // ─── Screen Navigation ───────────────────────────────────
  function showScreen(screenId) {
    $$('.screen').forEach((s) => s.classList.remove('screen--active'));
    $(screenId).classList.add('screen--active');
  }

  // ─── Selection screen live clock ─────────────────────────
  function startSelectClock() {
    function update() {
      if (els.selectLiveClock) {
        els.selectLiveClock.textContent = new Date().toLocaleTimeString('en-AU', {
          hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: true,
        });
      }
    }
    update();
    setInterval(update, 1000);
  }

  // ─── Render Worker Grid ──────────────────────────────────
  function renderWorkerGrid(account, onSelect, onAdd) {
    const profiles = account.profiles || [];
    let html = '';
    
    profiles.forEach(p => {
      const initials = p.name.split(' ').map((n) => n[0]).join('').toUpperCase();
      const active = Storage.getActiveShift(p.id);
      const statusClass = active ? 'worker-card__status--active' : 'worker-card__status--inactive';
      const statusText = active ? '● On Shift' : '○ Off Shift';
      
      html += `
        <div class="worker-card" data-profile-id="${p.id}">
          <div class="worker-card__avatar avatar-grad-1">${initials}</div>
          <div class="worker-card__name">${p.name}</div>
          <div class="worker-card__role">${p.role || 'Employee'}</div>
          <div class="worker-card__status ${statusClass}">${statusText}</div>
        </div>
      `;
    });

    // Add Profile Card (Netflix style)
    html += `
      <div class="worker-card worker-card--add" id="btnAddProfileCard">
        <div class="add-profile-icon">+</div>
        <div class="worker-card__name">Add Team</div>
      </div>
    `;

    els.workerGrid.innerHTML = html;

    els.workerGrid.querySelectorAll('.worker-card[data-profile-id]').forEach((card) => {
      card.addEventListener('click', () => onSelect(card.dataset.profileId));
    });

    $('#btnAddProfileCard').addEventListener('click', onAdd);
  }

  // ─── Update Dashboard ────────────────────────────────────
  async function updateDashboard(profile, isActive, activeShift) {
    els.dashWorkerName.textContent = profile.name;
    if (isActive) {
      els.dashStatus.textContent = 'On Shift';
      els.statusPill.classList.add('is-active');
      els.btnClock.className = 'clock-btn clock-btn--out';
      els.clockBtnText.textContent = 'Clock Out';
      els.shiftTimer.style.display = 'block';
      els.shiftSince.textContent = Clock.formatTime(activeShift.clockIn);
    } else {
      els.dashStatus.textContent = 'Off Shift';
      els.statusPill.classList.remove('is-active');
      els.btnClock.className = 'clock-btn clock-btn--in';
      els.clockBtnText.textContent = 'Clock In';
      els.shiftTimer.style.display = 'none';
    }

    const stats = await Storage.getStats(profile.id);
    els.statToday.textContent = Clock.formatHoursMinutes(stats.today);
    els.statWeek.textContent = Clock.formatHoursMinutes(stats.week);
    els.statShifts.textContent = stats.totalShifts;
    els.statTotalHours.textContent = Clock.formatHoursMinutes(stats.totalHours);

    // Payroll Calculation (Base 30k Rs.)
    const baseSalary = 30000;
    const workingDays = stats.workingDays;
    
    // IF leave is taken this month, 5% cut-off is 0 as per user request
    const cutoffValue = stats.hasLeaveThisMonth ? 0 : (baseSalary * 0.05);
    const takeHome = baseSalary - cutoffValue;

    els.statWorkingDays.textContent = `${workingDays} Days`;
    els.statLeaveDays.textContent = `${stats.leaveCount} Days`;
    
    if (stats.hasLeaveThisMonth) {
      els.statCutoff.textContent = `Waived (Leave)`;
      els.statCutoff.style.color = 'var(--success)';
    } else {
      els.statCutoff.textContent = `-Rs. ${cutoffValue.toLocaleString(undefined, { minimumFractionDigits: 2 })}`;
      els.statCutoff.style.color = 'var(--danger)';
    }
    
    els.statTakeHome.textContent = `Rs. ${takeHome.toLocaleString(undefined, { minimumFractionDigits: 2 })}`;
    
    // Add period info to the stat label
    const now = new Date();
    const periodEnd = (now.getDate() > 28) ? 
        new Date(now.getFullYear(), now.getMonth() + 1, 28) : 
        new Date(now.getFullYear(), now.getMonth(), 28);
    
    els.statCutoff.title = `Resets on ${periodEnd.toLocaleDateString()}`;
  }

  function updateShiftDuration(seconds) {
    els.shiftDuration.textContent = Clock.formatDuration(seconds);
    const LIMIT = 7 * 3600; // 7 Hours
    const pct = Math.min((seconds / LIMIT) * 100, 100);
    els.shiftProgressBar.style.width = pct + '%';
    
    if (seconds >= LIMIT) {
      els.shiftProgressBar.classList.add('is-overtime');
      els.dashStatus.innerHTML = '<span style="color:var(--danger)">Overtime!</span>';
    } else {
      els.shiftProgressBar.classList.remove('is-overtime');
    }
  }

  // ─── Modal & Form ────────────────────────────────────────
  function showClockOutModal(clockInISO) {
    els.modalClockIn.textContent = Clock.formatTime(clockInISO);
    els.modalDuration.textContent = Clock.formatDuration(Clock.getElapsedSeconds(clockInISO));
    els.clockOutForm.reset();
    resetRating();
    els.clockOutModal.classList.add('is-visible');
  }

  function hideClockOutModal() {
    els.clockOutModal.classList.remove('is-visible');
  }

  function showProfileModal() { els.modalAddProfile.classList.add('is-visible'); }
  function hideProfileModal() { els.modalAddProfile.classList.remove('is-visible'); els.formAddProfile.reset(); }

  let fpInstance = null;
  function showLeaveModal() { 
    els.modalLeave.classList.add('is-visible'); 
    if(!fpInstance && window.flatpickr) {
      fpInstance = flatpickr(els.leaveDate, { minDate: "today", dateFormat: "m/d/Y" });
    }
  }
  function hideLeaveModal() { els.modalLeave.classList.remove('is-visible'); els.formLeave.reset(); }

  let currentRating = 0;
  function initStarRating() {
    els.starRating.querySelectorAll('.star').forEach(star => {
      star.addEventListener('click', (e) => {
        e.preventDefault();
        currentRating = parseInt(star.dataset.value);
        els.starRating.querySelectorAll('.star').forEach(s => {
          s.classList.toggle('is-active', parseInt(s.dataset.value) <= currentRating);
        });
      });
    });
  }

  function resetRating() {
    currentRating = 0;
    els.starRating.querySelectorAll('.star').forEach(s => s.classList.remove('is-active'));
  }

  function getRating() { return currentRating; }

  function getFormData() {
    return {
      tasks: els.clockOutForm.querySelector('#fieldTasks').value.trim(),
      notes: els.clockOutForm.querySelector('#fieldNotes').value.trim() || null,
      rating: currentRating,
    };
  }

  // ─── History ──────────────────────────────────────────────
  function renderHistory(shifts) {
    if (!shifts.length) {
      els.historyList.innerHTML = '<div class="history-empty"><p>No shifts recorded yet</p></div>';
      return;
    }
    const grouped = {};
    let totalSeconds = 0;
    shifts.forEach((s) => {
      const dateKey = Clock.formatDate(s.clockIn);
      if (!grouped[dateKey]) grouped[dateKey] = [];
      grouped[dateKey].push(s);
      totalSeconds += s.duration || 0;
    });

    let html = '';
    Object.entries(grouped).forEach(([date, dayShifts]) => {
      html += `<div class="history-day"><div class="history-day__label">${date}</div>`;
      dayShifts.forEach((s) => {
        const taskPreview = s.formData?.tasks ? s.formData.tasks.substring(0, 50) + (s.formData.tasks.length > 50 ? '...' : '') : '';
        html += `
          <div class="history-item">
            <div>
              <div class="history-item__times">${Clock.formatTime(s.clockIn)} — ${Clock.formatTime(s.clockOut)}</div>
              ${taskPreview ? `<div class="history-item__tasks">${taskPreview}</div>` : ''}
            </div>
            <div class="history-item__duration">${Clock.formatHoursMinutes(s.duration)}</div>
          </div>
        `;
      });
      html += `</div>`;
    });
    els.historyList.innerHTML = html;
  }

  // ─── Toast ───────────────────────────────────────────────
  function toast(message, type = 'info') {
    const el = document.createElement('div');
    el.className = `toast toast--${type}`;
    el.innerHTML = `<span>${message}</span>`;
    els.toastContainer.appendChild(el);
    setTimeout(() => el.remove(), 4000);
  }

  return {
    els, initParticles, showScreen, startSelectClock, 
    renderWorkerGrid, updateDashboard, updateShiftDuration,
    showClockOutModal, hideClockOutModal, showProfileModal, hideProfileModal,
    showLeaveModal, hideLeaveModal,
    initStarRating, getRating,
    getFormData, renderHistory, toast
  };
})();

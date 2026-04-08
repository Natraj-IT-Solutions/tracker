/* ═══════════════════════════════════════════════════════════════
   APP — Main controller with advanced state management
   ═══════════════════════════════════════════════════════════════ */

(function () {
  let currentAccount = null;
  let currentProfile = null;

  async function init() {
    UI.initParticles();
    UI.startSelectClock();
    UI.initStarRating();

    window.addEventListener('unhandledrejection', (event) => {
      console.error('Unhandled Promise Rejection:', event.reason);
      UI.toast('Network or System Error occurred.', 'error');
    });

    window.onerror = function(msg, url, lineNo, columnNo, error) {
      console.error('Window Error:', msg, error);
      return false;
    };
    
    // Check session
    currentAccount = Auth.getUser() || Auth.init();
    if (currentAccount) {
      await Storage.initActiveShifts(currentAccount);
      showProfileSelection();
      checkOnboarding();
    } else {
      UI.showScreen('#screenWelcome');
    }

    bindEvents();
  }

  // ─── Auth Flows ───────────────────────────────────────────
  async function handleAuthSubmit(e) {
    e.preventDefault();
    const email = UI.els.authEmail.value.trim();
    const password = UI.els.authPassword.value.trim();
    const remember = UI.els.authRemember.checked;

    try {
      UI.els.btnAuthSubmit.disabled = true;
      UI.els.btnAuthSubmit.textContent = 'Signing In...';

      currentAccount = await Auth.login(email, password, remember);
      await Storage.initActiveShifts(currentAccount);
      UI.toast(`Welcome, ${currentAccount.email}`, 'success');
      showProfileSelection();
      checkOnboarding();
    } catch (err) {
      UI.toast(err.message, 'error');
    } finally {
      UI.els.btnAuthSubmit.disabled = false;
      UI.els.btnAuthSubmit.textContent = 'Sign In';
    }
  }

  function showProfileSelection() {
    UI.showScreen('#screenWorkerSelect');
    UI.renderWorkerGrid(currentAccount, selectProfile, () => UI.showProfileModal());
  }

  // ─── Profile Management ──────────────────────────────────
  async function handleProfileCreate(e) {
    e.preventDefault();
    const name = UI.els.newProfileName.value.trim();
    const role = UI.els.newProfileRole.value.trim();

    try {
      const fetchWithRetry = async (url, options, retries = 2) => {
        try {
          const res = await fetch(url, options);
          if (!res.ok) {
            const data = await res.json();
            throw new Error(data.error || `Server error: ${res.status}`);
          }
          return res;
        } catch (err) {
          if (retries > 0) return fetchWithRetry(url, options, retries - 1);
          throw err;
        }
      };

      const resp = await fetchWithRetry('/api/profiles', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ accId: currentAccount.id, profile: { name, role } })
      });
      const data = await resp.json();

      // Update local account data
      currentAccount.profiles.push(data.profile);
      Auth.setUser(currentAccount); // Update local storage if needed

      UI.hideProfileModal();
      UI.toast('Profile created!', 'success');
      showProfileSelection();
    } catch (err) {
      UI.toast(err.message, 'error');
    }
  }

  function selectProfile(profileId) {
    currentProfile = currentAccount.profiles.find(p => p.id === profileId);
    UI.showScreen('#screenDashboard');
    Clock.startLiveClock(UI.els.liveClock, UI.els.liveDate);

    const activeShift = Storage.getActiveShift(profileId);
    const isActive = !!activeShift;

    UI.updateDashboard(currentProfile, isActive, activeShift);

    if (isActive) {
      Clock.startTimer(activeShift.clockIn, (elapsed) => {
        UI.updateShiftDuration(elapsed);
      });
    }
  }

  function checkOnboarding() {
    const seen = sessionStorage.getItem('azura_onboarding_seen');
    if (!seen && currentAccount) {
      UI.showOnboarding();
    }
  }

  function markOnboardingSeen() {
    sessionStorage.setItem('azura_onboarding_seen', 'true');
    UI.hideOnboarding();
  }

  // ─── Tracker Flows ────────────────────────────────────────
  async function clockIn() {
    if (!currentProfile) return;
    const now = new Date().toISOString();
    Storage.setActiveShift(currentProfile.id, now);

    UI.updateDashboard(currentProfile, true, { clockIn: now });
    Clock.startTimer(now, (elapsed) => UI.updateShiftDuration(elapsed));
    UI.toast(`${currentProfile.name} clocked in!`, 'success');

    Email.sendClockIn(currentProfile.name, now).then(res => {
      if (!res.success) UI.toast('Email failed — shift recorded locally', 'info');
    });
  }

  function initiateClockOut() {
    if (!currentProfile) {
      console.error('Profile not found during clock-out.');
      return UI.toast('Employee profile lost. Please re-select your name.', 'error');
    }
    const activeShift = Storage.getActiveShift(currentProfile.id);
    if (!activeShift) {
      console.error('Active shift not found for profile:', currentProfile.id);
      return UI.toast('No active shift found. System might have auto-saved.', 'error');
    }
    UI.showClockOutModal(activeShift.clockIn);
  }

  async function submitClockOut(e) {
    e.preventDefault();
    const formData = UI.getFormData();
    
    if (!formData.tasks || formData.tasks.length < 5) {
      return UI.toast('Please describe your tasks (minimum 5 characters)', 'error');
    }

    try {
      UI.els.btnSubmitClockOut.disabled = true;
      UI.els.btnSubmitClockOut.classList.add('is-loading'); // In case CSS adds a loader
      
      const activeShift = Storage.getActiveShift(currentProfile.id);
      if (!activeShift) throw new Error('Active shift record missing. Please contact Admin.');

      const clockOutTime = new Date().toISOString();
      const duration = Clock.getElapsedSeconds(activeShift.clockIn);

      const res = await Storage.saveShift(currentProfile.id, {
        clockIn: activeShift.clockIn,
        clockOut: clockOutTime,
        duration,
        formData
      });

      if (res && res.error) {
        throw new Error(`Server Error: ${res.error}`);
      }
      
      Storage.clearActiveShift(currentProfile.id);
      Clock.stopTimer();
      UI.hideClockOutModal();
      UI.updateDashboard(currentProfile, false, null);
      UI.toast('Shift completed! Great work.', 'success');

      // Async email (don't block UI refresh)
      Email.sendClockOut(currentProfile.name, activeShift.clockIn, clockOutTime, duration, formData)
        .catch(err => console.error('Email delay/failure:', err));

    } catch (err) {
      console.error('Submit Clock Out Failure:', err);
      UI.toast(err.message || 'Clock out failed. Please try again.', 'error');
    } finally {
      UI.els.btnSubmitClockOut.disabled = false;
      UI.els.btnSubmitClockOut.classList.remove('is-loading');
    }
  }

  async function handleLeaveSubmit(e) {
    e.preventDefault();
    const reason = UI.els.leaveReason.value.trim();
    const dateVal = UI.els.leaveDate.value;
    if (!dateVal) return UI.toast('Please select a leave date', 'error');
    const date = new Date(dateVal).toISOString();

    try {
      UI.els.btnSubmitLeave.disabled = true;
      UI.els.btnSubmitLeave.textContent = 'Sending...';

      const res = await Storage.saveLeave(currentProfile.id, currentProfile.name, date, reason);
      if (!res.success) throw new Error('Save failed');

      await Email.sendTypedEmail('leave', {
        worker: currentProfile.name,
        date: date,
        reason: reason
      });

      UI.hideLeaveModal();
      UI.toast('Leave recorded and auto-approved!', 'success');
      
      const activeShift = Storage.getActiveShift(currentProfile.id);
      UI.updateDashboard(currentProfile, !!activeShift, activeShift);
    } catch (err) {
      UI.toast('Record saved locally', 'info');
      UI.hideLeaveModal();
    } finally {
      UI.els.btnSubmitLeave.disabled = false;
      UI.els.btnSubmitLeave.textContent = 'Submit & Send Email';
    }
  }

  function bindEvents() {
    UI.els.btnWelcomeSignIn.addEventListener('click', () => UI.showScreen('#screenAuth'));
    UI.els.btnAuthBack.addEventListener('click', () => UI.showScreen('#screenWelcome'));
    UI.els.authForm.addEventListener('submit', handleAuthSubmit);
    UI.els.btnLogout.addEventListener('click', () => Auth.logout());
    
    UI.els.btnCloseProfileModal.addEventListener('click', () => UI.hideProfileModal());
    UI.els.formAddProfile.addEventListener('submit', handleProfileCreate);

    UI.els.btnRequestLeave.addEventListener('click', () => UI.showLeaveModal());
    UI.els.btnCloseLeaveModal.addEventListener('click', () => UI.hideLeaveModal());
    UI.els.formLeave.addEventListener('submit', handleLeaveSubmit);

    UI.els.btnCloseOnboarding.addEventListener('click', markOnboardingSeen);

    UI.els.btnHistory.addEventListener('click', openHistory);
    UI.els.btnHistoryBack.addEventListener('click', () => UI.showScreen('#screenDashboard'));

    UI.els.btnClock.addEventListener('click', () => {
      const activeShift = Storage.getActiveShift(currentProfile?.id);
      if (activeShift) initiateClockOut();
      else clockIn();
    });

    UI.els.btnBack.addEventListener('click', () => {
      Clock.stopTimer();
      Clock.stopLiveClock();
      showProfileSelection();
    });

    UI.els.clockOutForm.addEventListener('submit', submitClockOut);
    UI.els.btnModalClose.addEventListener('click', () => UI.hideClockOutModal());
  }

  async function openHistory() {
    UI.toast('Loading history...', 'info');
    const stats = await Storage.getStats(currentProfile.id);
    UI.renderHistory(stats.history);
    UI.showScreen('#screenHistory');
  }

  document.addEventListener('DOMContentLoaded', init);
})();

/**
 * CVG-AEGIS — Extension Popup Script
 *
 * Shows enrollment form or device status based on enrollment state.
 */

const statusSection = document.getElementById('status-section');
const enrollSection = document.getElementById('enroll-section');
const statusText = document.getElementById('status-text');
const deviceIdEl = document.getElementById('device-id');
const policyCountEl = document.getElementById('policy-count');
const eventCountEl = document.getElementById('event-count');
const enrollBtn = document.getElementById('enroll-btn');
const flushBtn = document.getElementById('flush-btn');
const enrollError = document.getElementById('enroll-error');

// Check current status
chrome.runtime.sendMessage({ type: 'AEGIS_GET_STATUS' }, (response) => {
  if (response && response.enrolled) {
    showStatus(response);
  } else {
    showEnrollment();
  }
});

function showStatus(data) {
  statusSection.style.display = 'block';
  enrollSection.classList.remove('visible');

  statusText.textContent = 'Active';
  statusText.classList.add('active');
  deviceIdEl.textContent = data.deviceId ? data.deviceId.substring(0, 8) + '...' : '—';
  policyCountEl.textContent = data.policyCount || '0';
  eventCountEl.textContent = data.bufferedEvents || '0';
}

function showEnrollment() {
  statusSection.style.display = 'none';
  enrollSection.classList.add('visible');
}

// Enrollment
enrollBtn.addEventListener('click', async () => {
  const apiBase = document.getElementById('api-base').value.trim().replace(/\/$/, '');
  const token = document.getElementById('enroll-token').value.trim();

  if (!apiBase || !token) {
    enrollError.textContent = 'Both fields are required.';
    return;
  }

  enrollBtn.disabled = true;
  enrollBtn.textContent = 'Enrolling...';
  enrollError.textContent = '';

  chrome.runtime.sendMessage(
    { type: 'AEGIS_ENROLL', token, apiBase },
    (response) => {
      if (response && response.success) {
        showStatus({
          enrolled: true,
          deviceId: response.deviceId,
          policyCount: 0,
          bufferedEvents: 0,
        });
      } else {
        enrollError.textContent = response?.error || 'Enrollment failed.';
        enrollBtn.disabled = false;
        enrollBtn.textContent = 'Enroll Device';
      }
    }
  );
});

// Flush telemetry
flushBtn.addEventListener('click', () => {
  flushBtn.disabled = true;
  flushBtn.textContent = 'Flushing...';

  chrome.runtime.sendMessage({ type: 'AEGIS_FLUSH' }, () => {
    flushBtn.disabled = false;
    flushBtn.textContent = 'Flush Telemetry Now';
    eventCountEl.textContent = '0';
  });
});

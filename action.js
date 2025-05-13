document.addEventListener('DOMContentLoaded', () => {
  const title = document.getElementById('title');
  const message = document.getElementById('message');
  const authForm = document.getElementById('authForm');
  const authMessage = document.getElementById('authMessage');
  const emailInput = document.getElementById('emailInput');
  const otpInput = document.getElementById('otpInput');
  const submitButton = document.getElementById('submitButton');
  const settingsForm = document.getElementById('settingsForm');
  const userEmail = document.getElementById('userEmail');
  const popupToggle = document.getElementById('popupToggle');
  const toggleButton = document.getElementById('toggleButton');
  const logoutButton = document.getElementById('logoutButton');

  let email = '';

  // Load popup toggle state
  chrome.storage.local.get(['popupsEnabled'], (result) => {
    const popupsEnabled = result.popupsEnabled !== undefined ? result.popupsEnabled : true;
    popupToggle.checked = popupsEnabled;
  });

  // Save popup toggle state when changed
  popupToggle.addEventListener('change', () => {
    const popupsEnabled = popupToggle.checked;
    chrome.storage.local.set({ popupsEnabled: popupsEnabled }, () => {
      console.log('Popup toggle state saved:', popupsEnabled);
      message.textContent = `Popups ${popupsEnabled ? 'enabled' : 'disabled'}.`;
    });
  });

  // Check authentication status
  chrome.runtime.sendMessage({ action: 'checkAuth' }, (response) => {
    if (response.isAuthenticated) {
      title.textContent = 'Settings';
      message.textContent = 'You are authenticated.';
      authForm.style.display = 'none';
      settingsForm.style.display = 'block';
      chrome.storage.local.get(['userEmail'], (result) => {
        userEmail.textContent = `Logged in as: ${result.userEmail}`;
      });
      chrome.runtime.sendMessage({ action: 'getPopupSize' }, (sizeResponse) => {
        toggleButton.textContent = `Set to ${sizeResponse.size === 'full' ? 'Small' : 'Full'} Window`;
      });
    } else {
      title.textContent = 'Authenticate';
      message.textContent = '';
      authForm.style.display = 'block';
      settingsForm.style.display = 'none';
      emailInput.focus();
    }
  });

  // Handle submit button for OTP
  submitButton.addEventListener('click', () => {
    message.textContent = '';
    message.className = '';
    if (emailInput.style.display !== 'none') {
      email = emailInput.value.trim();
      if (!email.endsWith('@codingninjas.com')) {
        message.textContent = 'Please use a @codingninjas.com email.';
        message.className = 'error';
        return;
      }
      submitButton.disabled = true;
      submitButton.textContent = 'Loading...';
      message.textContent = 'Requesting OTP...';

      chrome.runtime.sendMessage({ action: 'requestOTP', email }, (response) => {
        submitButton.disabled = false;
        submitButton.textContent = 'Submit';
        if (response.error) {
          console.error('OTP Request Error:', response.error);
          message.textContent = response.error;
          message.className = 'error';
        } else {
          authMessage.textContent = 'Enter the OTP sent to your email:';
          emailInput.style.display = 'none';
          otpInput.style.display = 'block';
          submitButton.textContent = 'Verify OTP';
          message.textContent = '';
          otpInput.focus();
        }
      });
    } else {
      const otp = otpInput.value.trim();
      submitButton.disabled = true;
      submitButton.textContent = 'Loading...';
      message.textContent = 'Verifying OTP...';

      chrome.runtime.sendMessage({ action: 'verifyOTP', email, otp }, (response) => {
        submitButton.disabled = false;
        submitButton.textContent = 'Verify OTP';
        if (response.isAuthenticated) {
          title.textContent = 'Settings';
          message.textContent = 'Authentication successful!';
          authForm.style.display = 'none';
          settingsForm.style.display = 'block';
          chrome.storage.local.get(['userEmail'], (result) => {
            userEmail.textContent = `Logged in as: ${result.userEmail}`;
          });
          chrome.runtime.sendMessage({ action: 'getPopupSize' }, (sizeResponse) => {
            toggleButton.textContent = `Set to ${sizeResponse.size === 'full' ? 'Small' : 'Full'} Window`;
          });
        } else {
          console.error('OTP Verification Error:', response.error);
          message.textContent = response.error || 'Invalid or expired OTP.';
          message.className = 'error';
        }
      });
    }
  });

  // Handle popup size toggle
  toggleButton.addEventListener('click', () => {
    chrome.runtime.sendMessage({ action: 'getPopupSize' }, (response) => {
      const newSize = response.size === 'full' ? 'small' : 'full';
      chrome.runtime.sendMessage({ action: 'setPopupSize', size: newSize }, () => {
        toggleButton.textContent = `Set to ${newSize === 'full' ? 'Small' : 'Full'} Window`;
        message.textContent = `Default size set to ${newSize}.`;
      });
    });
  });

  // Handle logout
  logoutButton.addEventListener('click', () => {
    chrome.runtime.sendMessage({ action: 'logout' }, (response) => {
      if (response.success) {
        authMessage.textContent = 'Enter your @codingninjas.com email:';
        emailInput.style.display = 'block';
        otpInput.style.display = 'none';
        submitButton.textContent = 'Submit';
        emailInput.value = '';
        otpInput.value = '';
        message.textContent = '';
        message.className = '';
        title.textContent = 'Authenticate';
        authForm.style.display = 'block';
        settingsForm.style.display = 'none';
      }
    });
  });
});

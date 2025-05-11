document.addEventListener('DOMContentLoaded', () => {
  const title = document.getElementById('title');
  const message = document.getElementById('message');
  const authForm = document.getElementById('authForm');
  const authMessage = document.getElementById('authMessage');
  const emailInput = document.getElementById('emailInput');
  const otpInput = document.getElementById('otpInput');
  const submitButton = document.getElementById('submitButton');
  const settingsForm = document.getElementById('settingsForm');
  const toggleButton = document.getElementById('toggleButton');

  let email = '';

  // Check authentication status
  chrome.runtime.sendMessage({ action: 'checkAuth' }, (response) => {
    if (response.isAuthenticated) {
      title.textContent = 'Settings';
      message.textContent = 'You are authenticated.';
      authForm.style.display = 'none';
      settingsForm.style.display = 'block';
      chrome.runtime.sendMessage({ action: 'getPopupSize' }, (sizeResponse) => {
        toggleButton.textContent = `Set to ${sizeResponse.size === 'full' ? 'Small' : 'Full'} Window`;
      });
      // Add logout button
      const logoutButton = document.createElement('button');
      logoutButton.textContent = 'Logout';
      logoutButton.className = 'submit-btn';
      logoutButton.style.marginTop = '10px';
      logoutButton.addEventListener('click', () => {
        chrome.runtime.sendMessage({ action: 'logout' }, () => {
          // Window will be closed by background.js
        });
      });
      settingsForm.appendChild(logoutButton);
    } else {
      title.textContent = 'Authenticate';
      message.textContent = '';
      authForm.style.display = 'block';
      settingsForm.style.display = 'none';
    }
  });

  // Handle submit button for OTP
  submitButton.addEventListener('click', () => {
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
      message.className = '';

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
        }
      });
    } else {
      const otp = otpInput.value.trim();
      submitButton.disabled = true;
      submitButton.textContent = 'Loading...';
      message.textContent = 'Verifying OTP...';
      message.className = '';

      chrome.runtime.sendMessage({ action: 'verifyOTP', email, otp }, (response) => {
        submitButton.disabled = false;
        submitButton.textContent = 'Verify OTP';
        if (response.isAuthenticated) {
          title.textContent = 'Settings';
          message.textContent = 'Authentication successful!';
          message.className = '';
          authForm.style.display = 'none';
          settingsForm.style.display = 'block';
          chrome.runtime.sendMessage({ action: 'getPopupSize' }, (sizeResponse) => {
            toggleButton.textContent = `Set to ${sizeResponse.size === 'full' ? 'Small' : 'Full'} Window`;
          });
          // Add logout button
          const logoutButton = document.createElement('button');
          logoutButton.textContent = 'Logout';
          logoutButton.className = 'submit-btn';
          logoutButton.style.marginTop = '10px';
          logoutButton.addEventListener('click', () => {
            chrome.runtime.sendMessage({ action: 'logout' }, () => {
              // Window will be closed by background.js
            });
          });
          settingsForm.appendChild(logoutButton);
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
});

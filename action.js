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
  const connectionInfo = document.getElementById('connectionInfo');
  const connectionStatus = document.getElementById('connectionStatus');
  const popupToggle = document.getElementById('popupToggle');
  const toggleButton = document.getElementById('toggleButton');
  const logoutButton = document.getElementById('logoutButton');

  let email = '';
  let isSubmitting = false;

  // Initialize the popup
  init();

  function init() {
    loadSettings();
    checkAuthStatus();
    setupEventListeners();
  }

  function loadSettings() {
    chrome.storage.local.get(['popupsEnabled'], (result) => {
      const popupsEnabled = result.popupsEnabled !== undefined ? result.popupsEnabled : true;
      popupToggle.checked = popupsEnabled;
    });
  }

  function setupEventListeners() {
    // Popup toggle
    popupToggle.addEventListener('change', handlePopupToggle);

    // Submit button
    submitButton.addEventListener('click', handleSubmit);

    // Enter key support
    emailInput.addEventListener('keypress', (e) => {
      if (e.key === 'Enter' && !isSubmitting) {
        handleSubmit();
      }
    });

    otpInput.addEventListener('keypress', (e) => {
      if (e.key === 'Enter' && !isSubmitting) {
        handleSubmit();
      }
    });

    // Size toggle
    toggleButton.addEventListener('click', handleSizeToggle);

    // Logout
    logoutButton.addEventListener('click', handleLogout);

    // Auto-focus inputs
    emailInput.addEventListener('input', clearMessages);
    otpInput.addEventListener('input', clearMessages);
  }

  function clearMessages() {
    message.textContent = '';
    message.className = '';
  }

  function showMessage(text, type = 'info') {
    message.textContent = text;
    message.className = type;
  }

  function setLoading(loading) {
    isSubmitting = loading;
    submitButton.disabled = loading;
    
    if (loading) {
      submitButton.innerHTML = '<span class="loading"></span>Loading...';
    } else {
      submitButton.innerHTML = emailInput.style.display !== 'none' ? 'Submit' : 'Verify OTP';
    }
  }

  function handlePopupToggle() {
    const popupsEnabled = popupToggle.checked;
    chrome.storage.local.set({ popupsEnabled: popupsEnabled }, () => {
      console.log('Popup toggle state saved:', popupsEnabled);
      showMessage(`Notifications ${popupsEnabled ? 'enabled' : 'disabled'}.`, 'success');
      
      // Update server settings
      chrome.runtime.sendMessage({ 
        action: 'updatePopupSettings', 
        popupsEnabled: popupsEnabled 
      });
    });
  }

  function checkAuthStatus() {
    chrome.runtime.sendMessage({ action: 'checkAuth' }, (response) => {
      if (response && response.isAuthenticated) {
        showSettingsView();
      } else {
        showAuthView();
      }
    });
  }

  function showAuthView() {
    title.textContent = 'Authenticate';
    message.textContent = '';
    authForm.style.display = 'block';
    settingsForm.style.display = 'none';
    emailInput.focus();
  }

  function showSettingsView() {
    title.textContent = 'Settings';
    message.textContent = '';
    authForm.style.display = 'none';
    settingsForm.style.display = 'block';
    
    // Load user info
    chrome.storage.local.get(['userEmail'], (result) => {
      if (result.userEmail) {
        userEmail.textContent = `Logged in as: ${result.userEmail}`;
      }
    });

    // Load popup size
    chrome.runtime.sendMessage({ action: 'getPopupSize' }, (response) => {
      if (response) {
        updateSizeButton(response.size);
      }
    });

    // Check connection status
    updateConnectionStatus();
  }

  function updateSizeButton(size) {
    const isFullScreen = size === 'full';
    toggleButton.textContent = isFullScreen ? 'Full Screen' : 'Small Window';
    toggleButton.style.backgroundColor = isFullScreen ? '#f16222' : '#757575';
  }

  function updateConnectionStatus() {
    // This is a simple visual indicator - in a real app you'd check actual connection
    connectionStatus.className = 'status-indicator status-connected';
    connectionInfo.textContent = 'Connected to notification server';
  }

  function handleSubmit() {
    if (isSubmitting) return;

    clearMessages();
    
    if (emailInput.style.display !== 'none') {
      // Email submission
      email = emailInput.value.trim();
      if (!email) {
        showMessage('Please enter your email address.', 'error');
        emailInput.focus();
        return;
      }
      
      if (!email.endsWith('@codingninjas.com')) {
        showMessage('Please use a @codingninjas.com email address.', 'error');
        emailInput.focus();
        return;
      }

      setLoading(true);
      showMessage('Sending OTP to your email...', 'info');

      chrome.runtime.sendMessage({ action: 'requestOTP', email }, (response) => {
        setLoading(false);
        
        if (response && response.error) {
          console.error('OTP Request Error:', response.error);
          showMessage(response.error, 'error');
          emailInput.focus();
        } else {
          // Switch to OTP input
          authMessage.textContent = 'Enter the 6-digit OTP sent to your email:';
          emailInput.style.display = 'none';
          otpInput.style.display = 'block';
          submitButton.innerHTML = 'Verify OTP';
          showMessage('OTP sent successfully! Check your email.', 'success');
          otpInput.focus();
        }
      });
    } else {
      // OTP verification
      const otp = otpInput.value.trim();
      if (!otp) {
        showMessage('Please enter the OTP.', 'error');
        otpInput.focus();
        return;
      }

      if (otp.length !== 6 || !/^\d{6}$/.test(otp)) {
        showMessage('Please enter a valid 6-digit OTP.', 'error');
        otpInput.focus();
        return;
      }

      setLoading(true);
      showMessage('Verifying OTP...', 'info');
      chrome.runtime.sendMessage({ action: 'verifyOTP', email, otp }, (response) => {
        setLoading(false);
        
        if (response && response.isAuthenticated) {
          showMessage('Authentication successful!', 'success');
          setTimeout(() => {
            showSettingsView();
          }, 1000);
        } else {
          console.error('OTP Verification Error:', response ? response.error : 'Unknown error');
          showMessage(response ? response.error : 'Invalid or expired OTP. Please try again.', 'error');
          otpInput.focus();
          otpInput.select();
        }
      });
    }
  }

  function handleSizeToggle() {
    chrome.runtime.sendMessage({ action: 'getPopupSize' }, (response) => {
      if (response) {
        const newSize = response.size === 'full' ? 'small' : 'full';
        chrome.runtime.sendMessage({ action: 'setPopupSize', size: newSize }, (setResponse) => {
          if (setResponse && setResponse.success) {
            updateSizeButton(newSize);
            showMessage(`Popup size set to ${newSize === 'full' ? 'full screen' : 'small window'}.`, 'success');
          }
        });
      }
    });
  }

  function handleLogout() {
    if (confirm('Are you sure you want to logout?')) {
      chrome.runtime.sendMessage({ action: 'logout' }, (response) => {
        if (response && response.success) {
          // Reset form
          authMessage.textContent = 'Enter your @codingninjas.com email:';
          emailInput.style.display = 'block';
          otpInput.style.display = 'none';
          submitButton.innerHTML = 'Submit';
          emailInput.value = '';
          otpInput.value = '';
          email = '';
          
          // Show auth view
          showAuthView();
          showMessage('Logged out successfully.', 'success');
        }
      });
    }
  }

  // Handle runtime errors
  chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
    if (request.action === 'authError') {
      showMessage('Authentication session expired. Please login again.', 'error');
      showAuthView();
    }
  });
});
      

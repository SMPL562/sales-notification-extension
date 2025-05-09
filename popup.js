document.addEventListener('DOMContentLoaded', () => {
  const urlParams = new URLSearchParams(window.location.search);
  const type = urlParams.get('type');
  const bdeName = urlParams.get('bdeName');
  const product = urlParams.get('product');
  const managerName = urlParams.get('managerName');
  const messageText = urlParams.get('message');

  const title = document.getElementById('title');
  const message = document.getElementById('message');
  const authForm = document.getElementById('authForm');
  const authMessage = document.getElementById('authMessage');
  const emailInput = document.getElementById('emailInput');
  const otpInput = document.getElementById('otpInput');
  const submitButton = document.getElementById('submitButton');
  const closeButton = document.getElementById('closeButton');
  const sizeToggle = document.getElementById('sizeToggle');
  const toggleButton = document.getElementById('toggleButton');

  let email = '';

  // Check authentication status
  chrome.runtime.sendMessage({ action: 'checkAuth' }, (response) => {
    if (response.isAuthenticated) {
      title.textContent = type === 'sale_made' ? 'New Sale!' : 'Important Notification';
      if (type === 'sale_made') {
        message.textContent = `${bdeName} sold ${product}! Congrats from ${managerName}!`;
        createConfetti();
      } else if (type === 'notification') {
        message.innerHTML = `<span class="highlight">${messageText}</span>`;
      }
      authForm.style.display = 'none';
      closeButton.style.display = 'block';
      sizeToggle.style.display = 'block';
    } else {
      title.textContent = 'Authentication Required';
      message.textContent = '';
      authForm.style.display = 'block';
      closeButton.style.display = 'none';
      sizeToggle.style.display = 'none';
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
      chrome.runtime.sendMessage({ action: 'requestOTP', email }, (response) => {
        if (response.error) {
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
      chrome.runtime.sendMessage({ action: 'verifyOTP', email, otp }, (response) => {
        if (response.isAuthenticated) {
          title.textContent = type === 'sale_made' ? 'New Sale!' : 'Important Notification';
          if (type === 'sale_made') {
            message.textContent = `${bdeName} sold ${product}! Congrats from ${managerName}!`;
            createConfetti();
          } else if (type === 'notification') {
            message.innerHTML = `<span class="highlight">${messageText}</span>`;
          }
          message.className = '';
          authForm.style.display = 'none';
          closeButton.style.display = 'block';
          sizeToggle.style.display = 'block';
        } else {
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
        window.close();
        showPopup({ type, bdeName, product, managerName, message: messageText });
      });
    });
  });

  closeButton.addEventListener('click', () => {
    window.close();
  });

  function createConfetti() {
    const colors = ['#f16222', '#f37421', '#f68d1e', '#f7981d'];
    for (let i = 0; i < 50; i++) {
      const confetti = document.createElement('div');
      confetti.className = 'confetti';
      confetti.style.backgroundColor = colors[Math.floor(Math.random() * colors.length)];
      confetti.style.left = `${Math.random() * 100}vw`;
      confetti.style.animationDelay = `${Math.random() * 2}s`;
      document.body.appendChild(confetti);
    }
  }
});

document.addEventListener('DOMContentLoaded', () => {
  const urlParams = new URLSearchParams(window.location.search);
  const type = urlParams.get('type');
  const bdeName = urlParams.get('bdeName');
  const product = urlParams.get('product');
  const managerName = urlParams.get('managerName');
  const messageText = urlParams.get('message');

  const title = document.getElementById('title');
  const message = document.getElementById('message');
  const closeButton = document.getElementById('closeButton');
  const settingsButton = document.getElementById('settingsButton');
  const notificationIcon = document.getElementById('notificationIcon');
  const celebration = document.getElementById('celebration');

  // Auto-close timer
  let autoCloseTimer = null;
  const AUTO_CLOSE_DELAY = 10000; // 10 seconds

  // Initialize popup based on type
  initializePopup();

  function initializePopup() {
    switch (type) {
      case 'sale_made':
        setupSaleNotification();
        break;
      case 'notification':
        setupGeneralNotification();
        break;
      case 'private':
        setupPrivateNotification();
        break;
      default:
        setupErrorNotification();
        break;
    }

    setupEventListeners();
    startAutoCloseTimer();
  }

  function setupSaleNotification() {
    title.textContent = 'New Enrollment! 🎉';
    notificationIcon.innerHTML = '<i class="fas fa-trophy sale-icon"></i>';
    
    const bdeSpan = `<span class="bde-highlight">${escapeHtml(bdeName)}</span>`;
    const productSpan = `<span class="highlight">${escapeHtml(product)}</span>`;
    
    message.innerHTML = `
      ${bdeSpan} just sold ${productSpan}!<br>
      <small style="opacity: 0.8; font-size: 14px;">Congratulations from ${escapeHtml(managerName)}!</small>
    `;

    // Create celebration effects
    createCelebrationEffects();
    
    // Play celebration sound (if supported)
    playNotificationSound('success');
  }

  function setupGeneralNotification() {
    title.textContent = 'Important Update';
    notificationIcon.innerHTML = '<i class="fas fa-info-circle notification-icon-general"></i>';
    message.innerHTML = `<span class="highlight">${escapeHtml(messageText)}</span>`;
    
    playNotificationSound('info');
  }

  function setupPrivateNotification() {
    title.textContent = 'Personal Message';
    notificationIcon.innerHTML = '<i class="fas fa-envelope private-icon"></i>';
    message.innerHTML = `<span class="highlight">${escapeHtml(messageText)}</span>`;
    
    playNotificationSound('message');
  }

  function setupErrorNotification() {
    title.textContent = 'Error';
    notificationIcon.innerHTML = '<i class="fas fa-exclamation-triangle" style="color: #ff6b6b;"></i>';
    message.innerHTML = '<span class="highlight" style="background: #ff6b6b;">Unknown notification type</span>';
    
    console.error('Unknown popup type:', type);
  }

  function setupEventListeners() {
    closeButton.addEventListener('click', closePopup);
    settingsButton.addEventListener('click', openSettings);
    
    // Keyboard shortcuts
    document.addEventListener('keydown', handleKeyPress);
    
    // Prevent accidental close on container click
    document.querySelector('.container').addEventListener('click', (e) => {
      e.stopPropagation();
    });
        // Click outside to close
    document.addEventListener('click', (e) => {
      if (!e.target.closest('.container')) {
        closePopup();
      }
    });

    // Focus management for accessibility
    closeButton.focus();
  }

  function handleKeyPress(event) {
    switch (event.key) {
      case 'Escape':
        closePopup();
        break;
      case 'Enter':
        if (event.target === closeButton) {
          closePopup();
        } else if (event.target === settingsButton) {
          openSettings();
        }
        break;
      case ' ': // Space bar
        if (event.target === closeButton || event.target === settingsButton) {
          event.preventDefault();
          event.target.click();
        }
        break;
    }
  }

  function closePopup() {
    clearAutoCloseTimer();
    
    // Add closing animation
    document.body.style.animation = 'fadeOut 0.3s ease-in-out forwards';
    
    setTimeout(() => {
      try {
        window.close();
      } catch (error) {
        console.log('Could not close window:', error);
        // Fallback for cases where window.close() doesn't work
        document.body.innerHTML = '<div style="display: flex; justify-content: center; align-items: center; height: 100vh; color: white; font-family: Poppins, sans-serif;">Notification closed</div>';
      }
    }, 300);
  }

  function openSettings() {
    clearAutoCloseTimer();
    
    // Try to open settings popup
    try {
      chrome.runtime.sendMessage({ action: 'openSettings' }, (response) => {
        if (chrome.runtime.lastError) {
          console.error('Error opening settings:', chrome.runtime.lastError);
        }
        closePopup();
      });
    } catch (error) {
      console.error('Error sending message to background:', error);
      closePopup();
    }
  }

  function createCelebrationEffects() {
    if (type !== 'sale_made') return;

    // Create confetti
    for (let i = 0; i < 50; i++) {
      setTimeout(() => {
        createConfetti();
      }, i * 100);
    }

    // Create floating elements
    createFloatingElements();
  }

  function createConfetti() {
    const confetti = document.createElement('div');
    confetti.className = 'confetti';
    confetti.style.left = Math.random() * 100 + '%';
    confetti.style.animationDelay = Math.random() * 2 + 's';
    confetti.style.animationDuration = (Math.random() * 2 + 2) + 's';
    
    // Random colors
    const colors = ['#ffd700', '#f16222', '#64b5f6', '#81c784', '#e57373'];
    confetti.style.background = colors[Math.floor(Math.random() * colors.length)];
    
    celebration.appendChild(confetti);
    
    // Remove confetti after animation
    setTimeout(() => {
      if (confetti.parentNode) {
        confetti.parentNode.removeChild(confetti);
      }
    }, 4000);
  }

  function createFloatingElements() {
    const elements = ['💰', '🎉', '⭐', '🏆', '💎'];
    
    elements.forEach((element, index) => {
      setTimeout(() => {
        const floatingElement = document.createElement('div');
        floatingElement.textContent = element;
        floatingElement.style.position = 'fixed';
        floatingElement.style.fontSize = '24px';
        floatingElement.style.left = (20 + index * 15) + '%';
        floatingElement.style.top = '20%';
        floatingElement.style.pointerEvents = 'none';
        floatingElement.style.animation = 'float 3s ease-in-out infinite';
        floatingElement.style.animationDelay = (index * 0.5) + 's';
        floatingElement.style.zIndex = '10';
        
        document.body.appendChild(floatingElement);
        
        // Remove after animation
        setTimeout(() => {
          if (floatingElement.parentNode) {
            floatingElement.parentNode.removeChild(floatingElement);
          }
        }, 8000);
      }, index * 200);
    });
  }

  function playNotificationSound(soundType) {
    try {
      // Create audio context for sound effects
      const audioContext = new (window.AudioContext || window.webkitAudioContext)();
      
      let frequency;
      let duration;
      
      switch (soundType) {
        case 'success':
          // Happy chime sequence
          playTone(audioContext, 523.25, 0.1, 0); // C5
          playTone(audioContext, 659.25, 0.1, 0.1); // E5
          playTone(audioContext, 783.99, 0.2, 0.2); // G5
          break;
        case 'info':
          // Single pleasant tone
          playTone(audioContext, 440, 0.3, 0); // A4
          break;
        case 'message':
          // Soft double beep
          playTone(audioContext, 800, 0.1, 0);
          playTone(audioContext, 600, 0.1, 0.15);
          break;
        default:
          playTone(audioContext, 440, 0.2, 0);
      }
    } catch (error) {
      console.log('Audio not supported or blocked:', error);
    }
  }

  function playTone(audioContext, frequency, duration, startTime) {
    const oscillator = audioContext.createOscillator();
    const gainNode = audioContext.createGain();
    
    oscillator.connect(gainNode);
    gainNode.connect(audioContext.destination);
    
    oscillator.frequency.value = frequency;
    oscillator.type = 'sine';
    
    gainNode.gain.setValueAtTime(0, audioContext.currentTime + startTime);
    gainNode.gain.linearRampToValueAtTime(0.1, audioContext.currentTime + startTime + 0.01);
    gainNode.gain.exponentialRampToValueAtTime(0.01, audioContext.currentTime + startTime + duration);
    
    oscillator.start(audioContext.currentTime + startTime);
    oscillator.stop(audioContext.currentTime + startTime + duration);
  }

  function escapeHtml(text) {
    if (!text) return '';
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
  }

  function startAutoCloseTimer() {
    // Check if auto-close is enabled
    chrome.storage.local.get(['autoCloseEnabled'], (result) => {
      const autoCloseEnabled = result.autoCloseEnabled !== false; // Default to true
      
      if (autoCloseEnabled) {
        autoCloseTimer = setTimeout(() => {
          console.log('Auto-closing notification after timeout');
          closePopup();
        }, AUTO_CLOSE_DELAY);
        
        // Show countdown in close button
        showCountdown();
      }
    });
  }

  function showCountdown() {
    let remainingTime = AUTO_CLOSE_DELAY / 1000;
    const originalButtonText = closeButton.textContent;
    
    const countdownInterval = setInterval(() => {
      if (remainingTime <= 0) {
        clearInterval(countdownInterval);
        closeButton.textContent = originalButtonText;
        return;
      }
      
      closeButton.innerHTML = `<i class="fas fa-times"></i> Close (${remainingTime}s)`;
      remainingTime--;
    }, 1000);
    
    // Clear countdown if user interacts
    const clearCountdown = () => {
      clearInterval(countdownInterval);
      closeButton.innerHTML = '<i class="fas fa-times"></i> Close';
      clearAutoCloseTimer();
    };
    
    closeButton.addEventListener('mouseover', clearCountdown, { once: true });
    settingsButton.addEventListener('mouseover', clearCountdown, { once: true });
    document.addEventListener('keydown', clearCountdown, { once: true });
  }

  function clearAutoCloseTimer() {
    if (autoCloseTimer) {
      clearTimeout(autoCloseTimer);
      autoCloseTimer = null;
    }
  }

  // Handle visibility change to pause/resume timer
  document.addEventListener('visibilitychange', () => {
    if (document.hidden) {
      clearAutoCloseTimer();
    } else {
      startAutoCloseTimer();
    }
  });

  // Add CSS animations for floating elements
  const style = document.createElement('style');
  style.textContent = `
    @keyframes float {
      0%, 100% { transform: translateY(0px) rotate(0deg); }
      25% { transform: translateY(-20px) rotate(5deg); }
      50% { transform: translateY(-10px) rotate(-5deg); }
      75% { transform: translateY(-15px) rotate(3deg); }
    }
    
    @keyframes fadeOut {
      0% { opacity: 1; transform: scale(1); }
      100% { opacity: 0; transform: scale(0.9); }
    }
  `;
  document.head.appendChild(style);

  // Error handling for Chrome extension context
  window.addEventListener('error', (event) => {
    console.error('Popup error:', event.error);
    // Ensure popup can still be closed even if there's an error
    if (!closeButton.onclick) {
      closeButton.onclick = () => {
        try {
          window.close();
        } catch (e) {
          console.log('Fallback close');
          document.body.innerHTML = '<div style="display: flex; justify-content: center; align-items: center; height: 100vh; color: white; font-family: Poppins, sans-serif;">Notification closed</div>';
        }
      };
    }
  });

  // Prevent context menu
  document.addEventListener('contextmenu', (e) => {
    e.preventDefault();
  });

  // Log popup display for analytics/debugging
  console.log('Notification popup displayed:', {
    type: type,
    timestamp: new Date().toISOString(),
    bdeName: bdeName,
    product: product,
    managerName: managerName,
    message: messageText
  });
});

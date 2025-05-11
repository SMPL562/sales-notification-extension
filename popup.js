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
  const closeButton = document.getElementById('closeButton');
  const trophyContainer = document.querySelector('.trophy-container');

  if (type === 'sale_made') {
    title.textContent = 'New Enrolment!';
    message.innerHTML = `<span class="bde-highlight">${bdeName}</span> sold ${product}! Congrats from ${managerName}!`;
    trophyContainer.style.display = 'block'; // Show trophy for sale_made
    createMoneyFall();
  } else if (type === 'notification') {
    title.textContent = 'Important Notification';
    message.innerHTML = `<span class="highlight">${messageText}</span>`;
    trophyContainer.style.display = 'none'; // Hide trophy for notification
  } else if (type === 'private') {
    title.textContent = 'Personal Notification';
    message.innerHTML = `<span class="highlight">${messageText}</span>`;
    trophyContainer.style.display = 'none'; // Hide trophy for private
  } else {
    console.error('Unknown popup type:', type);
    return;
  }

  authForm.style.display = 'none';
  closeButton.style.display = 'block';

  closeButton.addEventListener('click', () => {
    window.close();
  });

  function createMoneyFall() {
    // Clear existing elements
    const existingElements = document.querySelectorAll('.money-coin, .money-usd, .firework');
    existingElements.forEach(element => element.remove());

    // Create new elements
    for (let i = 0; i < 50; i++) {
      // Golden coins
      const coin = document.createElement('div');
      coin.className = 'money-coin';
      coin.style.left = `${Math.random() * 100}%`;
      coin.style.animationDelay = `${Math.random() * 2}s`;
      document.body.appendChild(coin);

      // USD symbols
      const usd = document.createElement('div');
      usd.className = 'money-usd';
      usd.textContent = '$';
      usd.style.left = `${Math.random() * 100}%`;
      usd.style.animationDelay = `${Math.random() * 2}s`;
      document.body.appendChild(usd);

      // Fireworks
      const firework = document.createElement('div');
      firework.className = 'firework';
      firework.style.left = `${Math.random() * 100}%`;
      firework.style.animationDelay = `${Math.random() * 2}s`;
      document.body.appendChild(firework);
    }
  }
});

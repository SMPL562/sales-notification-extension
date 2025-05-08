document.addEventListener('DOMContentLoaded', () => {
  const urlParams = new URLSearchParams(window.location.search);
  const bdeName = urlParams.get('bdeName');
  const product = urlParams.get('product');
  const managerName = urlParams.get('managerName');

  const message = `${bdeName} sold ${product}! Congrats from ${managerName}!`;
  document.getElementById('message').textContent = message;

  // Close button handler
  document.getElementById('closeButton').addEventListener('click', () => {
    window.close();
  });

  // Create confetti
  function createConfetti() {
    const colors = ['#f00', '#0f0', '#00f', '#ff0', '#f0f'];
    for (let i = 0; i < 50; i++) {
      const confetti = document.createElement('div');
      confetti.className = 'confetti';
      confetti.style.backgroundColor = colors[Math.floor(Math.random() * colors.length)];
      confetti.style.left = `${Math.random() * 100}vw`;
      confetti.style.animationDelay = `${Math.random() * 2}s`;
      document.body.appendChild(confetti);
    }
  }
  createConfetti();
});

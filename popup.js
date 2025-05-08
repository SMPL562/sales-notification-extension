document.addEventListener('DOMContentLoaded', () => {
  const urlParams = new URLSearchParams(window.location.search);
  const bdeName = urlParams.get('bdeName');
  const product = urlParams.get('product');
  const managerName = urlParams.get('managerName');

  const message = `${bdeName} sold ${product}! Congrats from ${managerName}!`;
  document.getElementById('message').textContent = message;
});

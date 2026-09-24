(function (root) {
  function getWelcomeMessage(hour) {
    if (hour >= 5 && hour < 12) return 'สวัสดีตอนเช้า ขอให้วันนี้เป็นวันที่ดี';
    if (hour >= 12 && hour < 17) return 'สวัสดีตอนบ่าย ขอให้งานราบรื่นตลอดวัน';
    if (hour >= 17 && hour < 21) return 'สวัสดีตอนเย็น ขอบคุณสำหรับความตั้งใจในวันนี้';
    return 'สวัสดีตอนดึก ขอให้ทำงานอย่างปลอดภัย';
  }

  if (typeof module !== 'undefined' && module.exports) module.exports = { getWelcomeMessage };
  if (!root.document) return;

  const greeting = root.document.getElementById('welcomeGreeting');
  if (!greeting) return;

  function updateGreeting() {
    let hour;
    try {
      hour = Number(new Intl.DateTimeFormat('en-GB', {
        hour: '2-digit', hourCycle: 'h23', timeZone: 'Asia/Bangkok'
      }).format(new Date()));
    } catch (_) {
      hour = new Date().getHours();
    }
    greeting.textContent = getWelcomeMessage(hour);
  }

  updateGreeting();
  root.setInterval(updateGreeting, 60_000);
  root.document.addEventListener('visibilitychange', () => {
    if (!root.document.hidden) updateGreeting();
  });
})(typeof window !== 'undefined' ? window : globalThis);

(function (root) {
  const messages = {
    morning: [
      'สวัสดีตอนเช้า ขอให้วันนี้เป็นวันที่ดี',
      'สวัสดีตอนเช้า เริ่มวันด้วยพลังดีๆ',
      'สวัสดีตอนเช้า ขอให้งานวันนี้ราบรื่น',
      'สวัสดีตอนเช้า พร้อมเริ่มงานไปด้วยกัน',
      'สวัสดีตอนเช้า ขอให้ทุกขั้นตอนเป็นไปด้วยดี',
      'สวัสดีตอนเช้า ดูแลตัวเองระหว่างวันด้วยนะ'
    ],
    afternoon: [
      'สวัสดีตอนบ่าย ขอให้งานราบรื่นตลอดวัน',
      'สวัสดีตอนบ่าย พักสายตาสักครู่แล้วไปต่อ',
      'สวัสดีตอนบ่าย ขอให้จัดการงานได้ตามแผน',
      'สวัสดีตอนบ่าย ขอบคุณที่ใส่ใจทุกรายละเอียด',
      'สวัสดีตอนบ่าย ขอให้ช่วงที่เหลือของวันราบรื่น',
      'สวัสดีตอนบ่าย ค่อยๆ ทำงานทีละขั้นตอน'
    ],
    evening: [
      'สวัสดีตอนเย็น ขอบคุณสำหรับความตั้งใจในวันนี้',
      'สวัสดีตอนเย็น ขอให้ปิดงานได้เรียบร้อย',
      'สวัสดีตอนเย็น เหนื่อยมาทั้งวัน อย่าลืมพักผ่อน',
      'สวัสดีตอนเย็น ขอบคุณที่ช่วยดูแลงานวันนี้',
      'สวัสดีตอนเย็น ขอให้ช่วงเย็นเป็นไปอย่างราบรื่น',
      'สวัสดีตอนเย็น ตรวจงานให้ครบแล้วพักกันนะ'
    ],
    night: [
      'สวัสดีตอนดึก ขอให้ทำงานอย่างปลอดภัย',
      'สวัสดีตอนดึก อย่าลืมพักเมื่อมีโอกาส',
      'สวัสดีตอนดึก ขอให้ทุกงานผ่านไปอย่างราบรื่น',
      'สวัสดีตอนดึก ดูแลตัวเองระหว่างทำงานด้วยนะ',
      'สวัสดีตอนดึก ขอบคุณที่ช่วยดูแลงานคืนนี้',
      'สวัสดีตอนดึก ขอให้จบงานอย่างปลอดภัย'
    ]
  };

  function getWelcomeMessage(hour, halfHourSlot = 0, username = '') {
    const period = hour >= 5 && hour < 12 ? 'morning'
      : hour >= 12 && hour < 17 ? 'afternoon'
      : hour >= 17 && hour < 21 ? 'evening' : 'night';
    const choices = messages[period];
    const message = choices[((halfHourSlot % choices.length) + choices.length) % choices.length];
    const name = String(username || '').trim();
    return name ? message.replace(' ', ` ${name} `) : message;
  }

  if (typeof module !== 'undefined' && module.exports) module.exports = { getWelcomeMessage };
  if (!root.document) return;

  const greeting = root.document.getElementById('welcomeGreeting');
  if (!greeting) return;

  function updateGreeting() {
    let hour, minute;
    try {
      const parts = new Intl.DateTimeFormat('en-GB', {
        hour: '2-digit', minute: '2-digit', hourCycle: 'h23', timeZone: 'Asia/Bangkok'
      }).formatToParts(new Date());
      hour = Number(parts.find(part => part.type === 'hour').value);
      minute = Number(parts.find(part => part.type === 'minute').value);
    } catch (_) {
      hour = new Date().getHours();
      minute = new Date().getMinutes();
    }
    greeting.textContent = getWelcomeMessage(hour, hour * 2 + Math.floor(minute / 30), root.getWmsUsername?.());
  }

  updateGreeting();
  root.setInterval(updateGreeting, 30_000);
  root.addEventListener('wms:account-changed', updateGreeting);
  root.document.addEventListener('visibilitychange', () => {
    if (!root.document.hidden) updateGreeting();
  });
})(typeof window !== 'undefined' ? window : globalThis);

const assert = require('node:assert/strict');
const { getWelcomeMessage } = require('../welcome-greeting.js');

assert.match(getWelcomeMessage(5), /สวัสดีตอนเช้า/);
assert.match(getWelcomeMessage(11), /ขอให้วันนี้เป็นวันที่ดี/);
assert.match(getWelcomeMessage(12), /สวัสดีตอนบ่าย/);
assert.match(getWelcomeMessage(16), /งานราบรื่น/);
assert.match(getWelcomeMessage(17), /สวัสดีตอนเย็น/);
assert.match(getWelcomeMessage(20), /ความตั้งใจ/);
assert.match(getWelcomeMessage(21), /สวัสดีตอนดึก/);
assert.match(getWelcomeMessage(4), /ปลอดภัย/);

for (const hour of [5, 12, 17, 21]) {
  const firstHalf = getWelcomeMessage(hour, hour * 2);
  const secondHalf = getWelcomeMessage(hour, hour * 2 + 1);
  assert.notEqual(firstHalf, secondHalf, `ข้อความต้องเปลี่ยนเมื่อครบ 30 นาที (${hour}:00)`);
}
for (let slot = 0; slot < 47; slot++) {
  assert.notEqual(getWelcomeMessage(Math.floor(slot / 2), slot),
    getWelcomeMessage(Math.floor((slot + 1) / 2), slot + 1), `ข้อความซ้ำกันที่รอบ ${slot}`);
}

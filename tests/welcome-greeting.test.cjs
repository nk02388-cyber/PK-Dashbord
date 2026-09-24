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

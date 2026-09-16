const assert = require('node:assert/strict');
const {collectDailyMovements,summarizeDailyMovements} = require('../daily-movements.js');
const dateKey = value => /^\d{4}-\d{2}-\d{2}$/.test(value || '') ? value.replace(/-/g,'') : null;
const quantity = value => value == null || value === '' ? null : Number(value);
const stockCards = {
  F:{'F-01':[{code:'31-A',name:'ขวดสีขาว',lotNo:'PK-1',receiveDate:'2026-09-16',qty:100,unit:'ขวด',
    withdrawals:[{date:'2026-09-16',qty:20,by:'สมชาย'},{date:'2026-09-15',qty:5}],
    returns:[{date:'2026-09-16',qty:3,by:'สมชาย'}],
    locationMoves:[{date:'2026-09-16',from:'F/F-02',to:'F/F-01'}],
    transfersIn:[{date:'2026-09-16',qty:50,from:'F/F-02'}]}]},
  U:{'U-04':[{code:'51-B',name:'ฉลาก',receiveDate:'2026-09-16',qty:30,unit:'ใบ',
    withdrawals:[{date:'2026-09-16',qty:10}],transfersOut:[{date:'2026-09-16',qty:5,to:'U/U-05'}]},
    {code:'OLD',name:'รายการไม่ระบุวันที่',qty:10,unit:'ใบ',withdrawals:[{qty:2}]}]}
};
const before = JSON.stringify(stockCards);
const received = collectDailyMovements(stockCards,'2026-09-16','receive',dateKey,quantity);
assert.deepEqual(received.map(row => [row.type,row.code,row.qty]),[['รับเข้า','31-A',100],['รับคืน','31-A',3],['รับเข้า','51-B',30]]);
const issued = collectDailyMovements(stockCards,'2026-09-16','issue',dateKey,quantity);
assert.deepEqual(issued.map(row => [row.code,row.qty]),[['31-A',20],['51-B',10]]);
assert.equal(collectDailyMovements(stockCards,'2026-09-15','issue',dateKey,quantity).length,1);
assert.deepEqual(summarizeDailyMovements(received).units,[['ขวด',103],['ใบ',30]],'Mixed units stay separate');
assert.equal(summarizeDailyMovements(received).transactions,3);
assert.equal(summarizeDailyMovements(received).codes,2);
assert.equal(summarizeDailyMovements(received).slots,2);
assert.equal(JSON.stringify(stockCards),before,'Daily dashboard never changes STOCK CARD data');
console.log('PASS: daily receipt/return and issue dashboards exclude transfers, keep dates and units distinct');

const assert = require('node:assert/strict');
const test = require('node:test');
const {cleanEvents,dueEvents,upcomingEvents,eventTime} = require('../event-calendar.js');

const base = {id:'one',name:'ตรวจคลัง',date:'2026-09-25',time:'09:00',lead:1440,details:'โซน A'};

test('reminders start at the chosen lead time and stop after the appointment', () => {
  assert.equal(dueEvents([base],new Date(2026,8,24,8,59)).length,0);
  assert.equal(dueEvents([base],new Date(2026,8,24,9,0)).length,1);
  assert.equal(dueEvents([base],new Date(2026,8,25,9,30)).length,1);
  assert.equal(dueEvents([base],new Date(2026,8,25,10,0)).length,0);
});

test('invalid dates are rejected and upcoming events exclude past appointments', () => {
  assert.equal(eventTime({...base,date:'2026-02-30'}),null);
  assert.equal(cleanEvents([base,{...base,id:'bad',date:'2026-02-30'}]).length,1);
  assert.equal(upcomingEvents([base],new Date(2026,8,25,9,1)).length,0);
  assert.equal(upcomingEvents([base],new Date(2026,8,24,9,0)).length,1);
});

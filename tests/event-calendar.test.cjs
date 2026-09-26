const assert = require('node:assert/strict');
const test = require('node:test');
const {cleanEvents,dueEvents,upcomingEvents,eventTime,fromRow,toParams} = require('../event-calendar.js');

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

test('shared database rows preserve local appointment time and versioned save payload', () => {
  const event = fromRow({id:'one',name:'ตรวจคลัง',event_date:'2026-09-25',event_time:'09:00:00',lead_minutes:1440,details:'โซน A'});
  assert.deepEqual(event,base);
  assert.deepEqual(toParams(event,3),{p_id:'one',p_name:'ตรวจคลัง',p_date:'2026-09-25',p_time:'09:00',p_lead:1440,p_details:'โซน A',p_expected_version:3});
});

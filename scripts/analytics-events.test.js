import { test } from 'node:test';
import assert from 'node:assert/strict';
import { filterAnalyticsEvent } from '../lib/analytics-events.js';

test('admin page views and events are excluded, including email searches and encoded routes', () => {
  const urls = [
    'https://words.repeti.me/admin',
    'https://words.repeti.me/admin?q=person%40example.com',
    'https://words.repeti.me/admin/?q=person%40example.com&page=2',
    'https://words.repeti.me/admin/accounts',
    'https://words.repeti.me/admin/accounts/details?q=person%40example.com#results',
    'https://words.repeti.me/%61dmin?q=person%40example.com',
    'https://words.repeti.me/a%64min/accounts',
    'https://words.repeti.me/admin%2Faccounts',
    'https://words.repeti.me/admin%2faccounts',
    'https://words.repeti.me/practice/../admin',
    'http://localhost:3000/admin?q=person%40example.com',
  ];
  for (const url of urls) {
    for (const type of ['pageview', 'event']) {
      assert.equal(filterAnalyticsEvent({ type, url }), null, `${type}: ${url}`);
    }
  }
});

test('public and ordinary app analytics events are returned unchanged', () => {
  const urls = [
    'https://words.repeti.me/',
    'https://words.repeti.me/?ref=example',
    'https://words.repeti.me/login',
    'https://words.repeti.me/register',
    'https://words.repeti.me/vocabulary?category=Food',
    'https://words.repeti.me/practice/12',
    'https://words.repeti.me/settings',
    'https://words.repeti.me/administrator',
    'https://words.repeti.me/administrator/accounts',
    'https://words.repeti.me/admin-guide',
    'https://words.repeti.me/vocabulary?example=%2Fadmin',
    'https://words.repeti.me/vocabulary#admin',
    'http://localhost:3000/',
  ];
  for (const url of urls) {
    for (const type of ['pageview', 'event']) {
      const event = Object.freeze({ type, url });
      assert.equal(filterAnalyticsEvent(event), event, `${type}: ${url}`);
    }
  }
});

test('missing and malformed event URLs fail closed', () => {
  for (const event of [
    undefined, null, {}, { type: 'pageview' },
    { url: null }, { url: 1 }, { url: {} },
    { url: '' }, { url: 'not a URL' }, { url: '/admin' },
    { url: 'https://' }, { url: 'https://[invalid-host]/admin' },
    { url: 'https://words.repeti.me/%' },
    { url: 'https://words.repeti.me/%E0%A4%A' },
    { url: 'javascript:alert(1)' }, { url: 'data:text/plain,example' },
    { url: 'ftp://words.repeti.me/admin' },
  ]) assert.equal(filterAnalyticsEvent(event), null);
});

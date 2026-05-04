import { test } from 'node:test';
import assert from 'node:assert/strict';
import { detectHeadless } from '../../src/ui/browser.js';

test('detectHeadless: CI=true returns reason', () => {
  assert.equal(detectHeadless({ CI: 'true', DISPLAY: ':0' }, 'linux'), 'CI=true');
});

test('detectHeadless: KIT_MCP_NO_OPEN forces headless', () => {
  assert.equal(detectHeadless({ KIT_MCP_NO_OPEN: '1', DISPLAY: ':0' }, 'linux'), 'KIT_MCP_NO_OPEN');
});

test('detectHeadless: TERM=dumb returns reason', () => {
  assert.equal(detectHeadless({ TERM: 'dumb', DISPLAY: ':0' }, 'linux'), 'TERM=dumb');
});

test('detectHeadless: linux without DISPLAY/WAYLAND returns no_display', () => {
  assert.equal(detectHeadless({}, 'linux'), 'no_display');
});

test('detectHeadless: linux with DISPLAY is launchable', () => {
  assert.equal(detectHeadless({ DISPLAY: ':0' }, 'linux'), null);
});

test('detectHeadless: linux with WAYLAND_DISPLAY is launchable', () => {
  assert.equal(detectHeadless({ WAYLAND_DISPLAY: 'wayland-0' }, 'linux'), null);
});

test('detectHeadless: WSL is launchable (uses wslview)', () => {
  assert.equal(detectHeadless({ WSL_DISTRO_NAME: 'Ubuntu' }, 'linux'), null);
  assert.equal(detectHeadless({ WSLENV: 'foo' }, 'linux'), null);
});

test('detectHeadless: SSH session without DISPLAY returns ssh_no_display', () => {
  assert.equal(detectHeadless({ SSH_CONNECTION: '1.2.3.4 22 5.6.7.8 22' }, 'linux'), 'no_display');
  assert.equal(detectHeadless({ SSH_CONNECTION: '...' }, 'darwin'), 'ssh_no_display');
});

test('detectHeadless: macOS GUI session is launchable', () => {
  assert.equal(detectHeadless({}, 'darwin'), null);
});

test('detectHeadless: Windows GUI session is launchable', () => {
  assert.equal(detectHeadless({}, 'win32'), null);
});

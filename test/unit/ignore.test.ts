import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { IgnoreFilter } from '../../src/core/ignore';

describe('IgnoreFilter', () => {
  const defaults = [
    '**/node_modules/**',
    '**/.git/**',
    '**/dist/**',
    '**/out/**',
    '**/build/**',
    '**/*.lock',
    '**/package-lock.json',
    '**/*.min.*',
  ];

  it('ignores non-file URI schemes', () => {
    const filter = new IgnoreFilter(defaults);
    assert.equal(filter.isIgnored('output', 'output:extension-output-devlog'), true);
    assert.equal(filter.isIgnored('git', 'git:/path/to/repo'), true);
    assert.equal(filter.isIgnored('vscode-userdata', 'settings.json'), true);
  });

  it('ignores standard blacklisted directories and files', () => {
    const filter = new IgnoreFilter(defaults);
    assert.equal(filter.isIgnored('file', 'node_modules/picomatch/index.js'), true);
    assert.equal(filter.isIgnored('file', 'src/node_modules/pkg/index.js'), true);
    assert.equal(filter.isIgnored('file', '.git/HEAD'), true);
    assert.equal(filter.isIgnored('file', 'dist/extension.js'), true);
    assert.equal(filter.isIgnored('file', 'out/main.js'), true);
    assert.equal(filter.isIgnored('file', 'package-lock.json'), true);
    assert.equal(filter.isIgnored('file', 'yarn.lock'), true);
    assert.equal(filter.isIgnored('file', 'bundle.min.js'), true);
  });

  it('allows normal source files', () => {
    const filter = new IgnoreFilter(defaults);
    assert.equal(filter.isIgnored('file', 'src/extension.ts'), false);
    assert.equal(filter.isIgnored('file', 'src/core/heartbeat.ts'), false);
    assert.equal(filter.isIgnored('file', 'README.md'), false);
    assert.equal(filter.isIgnored('file', 'package.json'), false);
  });

  it('handles Windows backslash paths correctly', () => {
    const filter = new IgnoreFilter(defaults);
    assert.equal(filter.isIgnored('file', 'node_modules\\lodash\\index.js'), true);
    assert.equal(filter.isIgnored('file', 'src\\components\\Button.tsx'), false);
  });

  it('dynamically recompiles when patterns update', () => {
    const filter = new IgnoreFilter(defaults);
    assert.equal(filter.isIgnored('file', 'secret.env'), false);

    filter.updatePatterns([...defaults, '**/*.env']);
    assert.equal(filter.isIgnored('file', 'secret.env'), true);
    assert.equal(filter.isIgnored('file', 'config/prod.env'), true);
  });
});

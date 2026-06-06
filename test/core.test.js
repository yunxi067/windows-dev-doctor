import test from 'node:test';
import assert from 'node:assert/strict';

import {
  analyzeEnvironment,
  buildCommandInvocation,
  buildReport,
  createToolCheck,
  parseNetstat,
  resolveWindowsCommand,
  scoreReport,
  summarizeToolOutput,
  toTextReport
} from '../src/core.js';

test('summarizeToolOutput extracts useful versions from stdout and stderr', () => {
  assert.equal(summarizeToolOutput('git', { stdout: 'git version 2.48.1.windows.1\n' }), '2.48.1.windows.1');
  assert.equal(summarizeToolOutput('java', { stderr: 'java version "21.0.2" 2024-01-16\n' }), '21.0.2');
  assert.equal(summarizeToolOutput('dockerDaemon', { stdout: 'Server:\n Containers: 2\n' }), 'daemon reachable');
});

test('createToolCheck marks missing tools with Chinese repair suggestions', () => {
  const check = createToolCheck({
    id: 'git',
    label: 'Git',
    command: 'git --version',
    result: { ok: false, error: 'not found' }
  });

  assert.equal(check.status, 'fail');
  assert.equal(check.title, 'Git');
  assert.match(check.suggestion, /安装 Git/);
});

test('resolveWindowsCommand uses Windows executable shims for cmd and exe tools', () => {
  assert.equal(resolveWindowsCommand('npm', 'win32'), 'npm.cmd');
  assert.equal(resolveWindowsCommand('py', 'win32'), 'py.exe');
  assert.equal(resolveWindowsCommand('git', 'win32'), 'git');
  assert.equal(resolveWindowsCommand('npm', 'linux'), 'npm');
});

test('buildCommandInvocation wraps Windows cmd shims through cmd.exe', () => {
  assert.deepEqual(buildCommandInvocation('npm.cmd', ['--version'], 'win32'), {
    file: 'cmd.exe',
    args: ['/d', '/c', 'npm.cmd --version']
  });
  assert.deepEqual(buildCommandInvocation('git', ['--version'], 'win32'), {
    file: 'git',
    args: ['--version']
  });
});

test('analyzeEnvironment finds PATH duplicates, missing common variables, and risky proxy settings', () => {
  const env = {
    Path: 'C:\\Tools\\Git\\bin;C:\\Tools\\Git\\bin;C:\\Missing\\Bin',
    TEMP: 'C:\\Temp',
    HTTP_PROXY: 'http://127.0.0.1:7890'
  };

  const checks = analyzeEnvironment(env, {
    existsSync: (value) => !value.includes('Missing')
  });
  const ids = checks.map((item) => item.id);

  assert.equal(ids.includes('env-path-duplicates'), true);
  assert.equal(ids.includes('env-path-missing-dir'), true);
  assert.equal(ids.includes('env-java-home'), true);
  assert.equal(ids.includes('env-proxy'), true);
});

test('parseNetstat maps listening ports to pid and process name when tasklist data is available', () => {
  const netstat = `
  TCP    0.0.0.0:3000           0.0.0.0:0              LISTENING       1234
  TCP    [::]:8080              [::]:0                 LISTENING       5678
`;
  const tasklist = `
node.exe                     1234 Console                    1     40,000 K
java.exe                     5678 Console                    1    120,000 K
`;

  const ports = parseNetstat(netstat, tasklist, [3000, 8080, 5173]);

  assert.deepEqual(ports.map((item) => ({
    port: item.port,
    occupied: item.occupied,
    pid: item.pid,
    processName: item.processName
  })), [
    { port: 3000, occupied: true, pid: 1234, processName: 'node.exe' },
    { port: 8080, occupied: true, pid: 5678, processName: 'java.exe' },
    { port: 5173, occupied: false, pid: null, processName: null }
  ]);
});

test('buildReport and scoreReport produce an overall health summary', () => {
  const report = buildReport({
    platform: 'win32',
    toolChecks: [
      { id: 'git', status: 'pass' },
      { id: 'node', status: 'pass' },
      { id: 'docker', status: 'warn' },
      { id: 'python', status: 'fail' }
    ],
    environmentChecks: [
      { id: 'env-path', status: 'pass' },
      { id: 'env-java-home', status: 'warn' }
    ],
    portChecks: [
      { port: 3000, status: 'warn', occupied: true },
      { port: 5173, status: 'pass', occupied: false }
    ]
  });

  assert.equal(scoreReport(report).score, 63);
  assert.equal(report.summary.level, 'needs-attention');
});

test('toTextReport renders Chinese sections and concrete repair commands', () => {
  const text = toTextReport({
    generatedAt: '2026-06-06T00:00:00.000Z',
    platform: 'win32',
    summary: { score: 75, level: 'good', title: '整体良好' },
    sections: [
      {
        title: '工具链',
        items: [
          {
            id: 'git',
            title: 'Git',
            status: 'fail',
            detail: '未检测到 git --version',
            suggestion: '安装 Git for Windows 后重新打开终端。'
          }
        ]
      }
    ]
  });

  assert.match(text, /Windows Dev Doctor 巡检报告/);
  assert.match(text, /工具链/);
  assert.match(text, /安装 Git for Windows/);
});

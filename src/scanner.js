import { execFile } from 'node:child_process';
import fs from 'node:fs';
import { promisify } from 'node:util';

import {
  analyzeEnvironment,
  buildCommandInvocation,
  buildReport,
  createCommandCheck,
  createToolCheck,
  DEFAULT_PORTS,
  parseNpmRegistry,
  parseNetstat,
  parsePipConfig,
  parsePowerShellExecutionPolicy,
  resolveWindowsCommand
} from './core.js';

const execFileAsync = promisify(execFile);

const TOOL_COMMANDS = [
  { id: 'git', label: 'Git', command: 'git --version', file: 'git', args: ['--version'] },
  { id: 'node', label: 'Node.js', command: 'node --version', file: 'node', args: ['--version'] },
  { id: 'npm', label: 'npm', command: 'npm --version', file: 'npm', args: ['--version'] },
  { id: 'python', label: 'Python', command: 'python --version', file: 'python', args: ['--version'] },
  { id: 'py', label: 'Python Launcher', command: 'py --version', file: 'py', args: ['--version'] },
  { id: 'java', label: 'Java', command: 'java -version', file: 'java', args: ['-version'] },
  { id: 'docker', label: 'Docker CLI', command: 'docker --version', file: 'docker', args: ['--version'] },
  { id: 'dockerDaemon', label: 'Docker Engine', command: 'docker info', file: 'docker', args: ['info'] },
  { id: 'wsl', label: 'WSL', command: 'wsl --status', file: 'wsl', args: ['--status'] },
  { id: 'pnpm', label: 'pnpm', command: 'pnpm --version', file: 'pnpm', args: ['--version'] },
  { id: 'yarn', label: 'Yarn', command: 'yarn --version', file: 'yarn', args: ['--version'] },
  { id: 'maven', label: 'Maven', command: 'mvn --version', file: 'mvn', args: ['--version'] },
  { id: 'gradle', label: 'Gradle', command: 'gradle --version', file: 'gradle', args: ['--version'] }
];

export async function scanSystem(options = {}) {
  const ports = options.ports ?? DEFAULT_PORTS;
  const toolChecks = await scanTools(options);
  const environmentChecks = analyzeEnvironment(process.env, { existsSync: fs.existsSync });
  const configChecks = await scanConfig(options);
  const portChecks = await scanPorts(ports, options);

  return buildReport({
    platform: process.platform,
    toolChecks,
    environmentChecks,
    configChecks,
    portChecks
  });
}

async function scanTools(options) {
  const commands = options.toolCommands ?? TOOL_COMMANDS;
  const checks = [];
  for (const tool of commands) {
    const command = buildCommandInvocation(resolveWindowsCommand(tool.file), tool.args);
    const result = await runCommand(command.file, command.args, { timeoutMs: options.timeoutMs ?? 5000 });
    checks.push(createToolCheck({ ...tool, result }));
  }
  return checks;
}

async function scanConfig(options) {
  const timeoutMs = options.timeoutMs ?? 5000;
  const checks = [];

  if (process.platform === 'win32' || options.forceWindowsCommands) {
    const policy = await runCommand('powershell.exe', [
      '-NoProfile',
      '-Command',
      'Get-ExecutionPolicy -Scope CurrentUser'
    ], { timeoutMs });
    checks.push(createCommandCheck({
      id: 'powershell-execution-policy',
      title: 'PowerShell 执行策略',
      command: 'powershell.exe Get-ExecutionPolicy',
      result: policy,
      analyze: parsePowerShellExecutionPolicy
    }));
  } else {
    checks.push({
      id: 'powershell-execution-policy',
      title: 'PowerShell 执行策略',
      status: 'warn',
      detail: '当前平台不是 Windows，跳过 PowerShell 执行策略检查。',
      suggestion: '在 Windows 终端中运行可获得准确结果。'
    });
  }

  const npmCommand = buildCommandInvocation(resolveWindowsCommand('npm'), ['config', 'get', 'registry']);
  const npmRegistry = await runCommand(npmCommand.file, npmCommand.args, { timeoutMs });
  checks.push(createCommandCheck({
    id: 'npm-registry',
    title: 'npm 镜像源',
    command: 'npm config get registry',
    result: npmRegistry,
    analyze: parseNpmRegistry
  }));

  const pipConfig = await runCommand(resolveWindowsCommand('pip'), ['config', 'list'], { timeoutMs });
  if (pipConfig.ok) {
    checks.push(parsePipConfig(pipConfig.stdout));
  } else {
    checks.push({
      id: 'pip-index-url',
      title: 'pip 镜像源',
      status: 'warn',
      detail: `无法运行 pip config list：${pipConfig.error}`,
      suggestion: '如果你使用 Python 开发，请确认 pip 可用；不使用 Python 可忽略。'
    });
  }

  return checks;
}

async function scanPorts(ports, options) {
  if (process.platform !== 'win32' && !options.forceWindowsCommands) {
    return ports.map((port) => ({
      port,
      status: 'warn',
      occupied: false,
      pid: null,
      processName: null,
      detail: '当前平台不是 Windows，跳过 netstat -ano 端口巡检。',
      suggestion: '在 Windows 终端中运行可获得准确端口占用结果。'
    }));
  }

  const [netstat, tasklist] = await Promise.all([
    runCommand('netstat', ['-ano'], { timeoutMs: options.timeoutMs ?? 8000 }),
    runCommand('tasklist', [], { timeoutMs: options.timeoutMs ?? 8000 })
  ]);

  if (!netstat.ok) {
    return ports.map((port) => ({
      port,
      status: 'warn',
      occupied: false,
      pid: null,
      processName: null,
      detail: `无法运行 netstat -ano：${netstat.error}`,
      suggestion: '确认系统命令 netstat 可用，或使用管理员/普通 PowerShell 重新运行。'
    }));
  }

  return parseNetstat(netstat.stdout, tasklist.stdout ?? '', ports);
}

async function runCommand(file, args, options = {}) {
  try {
    const result = await execFileAsync(file, args, {
      timeout: options.timeoutMs ?? 5000,
      windowsHide: true,
      maxBuffer: 1024 * 1024
    });
    return { ok: true, stdout: result.stdout, stderr: result.stderr };
  } catch (error) {
    return {
      ok: false,
      stdout: error.stdout ?? '',
      stderr: error.stderr ?? '',
      error: error.code === 'ENOENT' ? '命令不存在或未加入 PATH' : error.message
    };
  }
}

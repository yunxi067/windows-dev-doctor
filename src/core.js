export const DEFAULT_PORTS = [80, 443, 3000, 3306, 5432, 5173, 6379, 8000, 8080, 9000, 27017];

const TOOL_REPAIR = {
  git: '安装 Git for Windows：https://git-scm.com/download/win；安装后重新打开终端并确认 git --version。',
  node: '安装 Node.js LTS：https://nodejs.org/；建议使用 nvm-windows 管理多个版本。',
  npm: 'Node.js 通常自带 npm；如果缺失，请重新安装 Node.js LTS。',
  python: '安装 Python 3：https://www.python.org/downloads/windows/；安装时勾选 Add python.exe to PATH。',
  py: '安装 Python Launcher 或确保 Python 安装器勾选了 launcher 选项。',
  java: '安装 JDK 17 或 21，例如 Eclipse Temurin，并配置 JAVA_HOME 与 PATH。',
  docker: '安装 Docker Desktop for Windows，并确认 WSL2/虚拟化已启用。',
  dockerDaemon: '启动 Docker Desktop，等待引擎就绪后再运行 docker info。',
  wsl: '如需 Linux 开发环境，可安装或启用 WSL2：在管理员 PowerShell 中运行 wsl --install。',
  pnpm: '如需 pnpm，可先运行 corepack enable，再运行 corepack prepare pnpm@latest --activate。',
  yarn: '如需 Yarn，可先运行 corepack enable，再运行 corepack prepare yarn@stable --activate。',
  maven: '如需 Java 后端构建工具，可安装 Maven 并将 mvn 所在目录加入 PATH。',
  gradle: '如需 Gradle 构建工具，可安装 Gradle 或使用项目自带的 gradlew。'
};

const OPTIONAL_TOOL_IDS = new Set(['dockerDaemon', 'wsl', 'pnpm', 'yarn', 'maven', 'gradle']);

export function summarizeToolOutput(id, result = {}) {
  const text = `${result.stdout ?? ''}\n${result.stderr ?? ''}`;
  if (id === 'dockerDaemon' && /server:|containers:|server version/i.test(text)) return 'daemon reachable';
  const quoted = text.match(/version\s+"?v?([0-9][0-9A-Za-z._+-]*)"?/i);
  if (quoted) return quoted[1];
  const loose = text.match(/\bv?([0-9]+(?:\.[0-9A-Za-z_-]+){1,4})\b/);
  return loose ? loose[1] : text.trim().split(/\r?\n/)[0]?.trim() || 'available';
}

export function createToolCheck({ id, label, command, result }) {
  if (result?.ok) {
    return {
      id,
      title: label,
      status: 'pass',
      detail: `${command} -> ${summarizeToolOutput(id, result)}`,
      suggestion: ''
    };
  }

  const unavailable = result?.error ? `未检测到 ${command}：${result.error}` : `未检测到 ${command}`;
  return {
    id,
    title: label,
    status: OPTIONAL_TOOL_IDS.has(id) ? 'warn' : 'fail',
    detail: unavailable,
    suggestion: TOOL_REPAIR[id] ?? '确认工具已安装，并且可执行文件所在目录已加入 PATH。'
  };
}

export function createCommandCheck({ id, title, command, result, analyze }) {
  if (!result?.ok) {
    return {
      id,
      title,
      status: 'warn',
      detail: `无法运行 ${command}：${result?.error ?? '命令执行失败'}`,
      suggestion: '如果你依赖这个配置，请确认对应命令可用后重新运行巡检。'
    };
  }

  return {
    id,
    title,
    ...analyze(String(result.stdout ?? '').trim())
  };
}

export function parsePowerShellExecutionPolicy(output = '') {
  const policy = firstMeaningfulLine(output) || 'Undefined';
  const restrictive = new Set(['Restricted', 'AllSigned', 'Undefined']);
  const status = restrictive.has(policy) ? 'warn' : 'pass';

  return {
    id: 'powershell-execution-policy',
    title: 'PowerShell 执行策略',
    status,
    detail: `ExecutionPolicy=${policy}`,
    suggestion: status === 'warn'
      ? '如果 npm/pnpm 脚本无法运行，可在当前用户范围执行 Set-ExecutionPolicy RemoteSigned -Scope CurrentUser。'
      : ''
  };
}

export function parseNpmRegistry(output = '') {
  const registry = firstMeaningfulLine(output);
  const isOfficial = registry === 'https://registry.npmjs.org/';

  return {
    status: registry ? 'pass' : 'warn',
    detail: registry ? `registry=${registry}` : '未读取到 npm registry。',
    suggestion: registry && !isOfficial ? '当前 npm registry 不是官方源；如果安装异常，请确认镜像源可用。' : ''
  };
}

export function parsePipConfig(output = '') {
  const indexUrl = findConfigValue(output, ['global.index-url', 'index-url']);

  return {
    id: 'pip-index-url',
    title: 'pip 镜像源',
    status: indexUrl ? 'pass' : 'warn',
    detail: indexUrl ? `index-url=${indexUrl}` : '未检测到 pip index-url 配置。',
    suggestion: indexUrl ? '' : '如果 pip 安装很慢，可以配置可信的国内镜像源；不需要镜像时可忽略。'
  };
}

export function analyzeEnvironment(env = process.env, options = {}) {
  const existsSync = options.existsSync ?? (() => true);
  const checks = [];
  const pathValue = env.Path ?? env.PATH ?? '';
  const segments = pathValue.split(';').map((item) => item.trim()).filter(Boolean);
  const normalized = segments.map((item) => item.toLowerCase());
  const duplicates = segments.filter((item, index) => normalized.indexOf(item.toLowerCase()) !== index);
  const missingDirs = segments.filter((item) => !isExpandable(item) && !existsSync(item));

  checks.push({
    id: 'env-path-present',
    title: 'PATH 环境变量',
    status: segments.length ? 'pass' : 'fail',
    detail: segments.length ? `PATH 包含 ${segments.length} 个目录。` : 'PATH 为空或不可读取。',
    suggestion: segments.length ? '' : '恢复 PATH，至少包含 Windows、System32、Git、Node、Python 等常用目录。'
  });

  if (duplicates.length) {
    checks.push({
      id: 'env-path-duplicates',
      title: 'PATH 重复项',
      status: 'warn',
      detail: `发现 ${unique(duplicates).length} 个重复目录：${unique(duplicates).slice(0, 5).join('；')}`,
      suggestion: '在“系统属性 -> 环境变量”里合并重复 PATH 项，减少命令解析混乱。'
    });
  }

  if (missingDirs.length) {
    checks.push({
      id: 'env-path-missing-dir',
      title: 'PATH 失效目录',
      status: 'warn',
      detail: `发现 ${missingDirs.length} 个不存在的 PATH 目录：${missingDirs.slice(0, 5).join('；')}`,
      suggestion: '删除不存在的 PATH 目录，或修复对应工具安装路径。'
    });
  }

  for (const name of ['TEMP', 'TMP']) {
    const value = env[name] ?? '';
    checks.push({
      id: `env-${name.toLowerCase()}`,
      title: `${name} 临时目录`,
      status: value ? 'pass' : 'warn',
      detail: value ? `${name}=${value}` : `${name} 未配置。`,
      suggestion: value ? '' : `配置 ${name} 到可写目录，例如 C:\\Users\\<你>\\AppData\\Local\\Temp。`
    });
  }

  checks.push({
    id: 'env-java-home',
    title: 'JAVA_HOME',
    status: env.JAVA_HOME ? 'pass' : 'warn',
    detail: env.JAVA_HOME ? `JAVA_HOME=${env.JAVA_HOME}` : 'JAVA_HOME 未配置。',
    suggestion: env.JAVA_HOME ? '' : '如果需要 Java 开发，请将 JAVA_HOME 指向 JDK 根目录，并把 %JAVA_HOME%\\bin 加入 PATH。'
  });

  if (env.HTTP_PROXY || env.HTTPS_PROXY || env.http_proxy || env.https_proxy) {
    checks.push({
      id: 'env-proxy',
      title: '代理环境变量',
      status: 'warn',
      detail: '检测到 HTTP_PROXY/HTTPS_PROXY，可能影响 npm、pip、git、docker 拉取资源。',
      suggestion: '如果网络异常，确认代理地址可用；不需要代理时可临时 unset HTTP_PROXY HTTPS_PROXY。'
    });
  }

  return checks;
}

export function parseNetstat(netstatOutput = '', tasklistOutput = '', targetPorts = DEFAULT_PORTS) {
  const processes = parseTasklist(tasklistOutput);
  const occupied = new Map();

  for (const line of netstatOutput.split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!/^TCP\s+/i.test(trimmed) || !/\bLISTENING\b/i.test(trimmed)) continue;
    const parts = trimmed.split(/\s+/);
    const localAddress = parts[1] ?? '';
    const pid = Number(parts.at(-1));
    const port = extractPort(localAddress);
    if (Number.isFinite(port) && Number.isFinite(pid)) {
      occupied.set(port, { pid, processName: processes.get(pid) ?? null });
    }
  }

  return targetPorts.map((port) => {
    const hit = occupied.get(Number(port));
    return {
      port: Number(port),
      status: hit ? 'warn' : 'pass',
      occupied: Boolean(hit),
      pid: hit?.pid ?? null,
      processName: hit?.processName ?? null,
      detail: hit ? `端口 ${port} 正被 PID ${hit.pid}${hit.processName ? ` (${hit.processName})` : ''} 占用。` : `端口 ${port} 当前空闲。`,
      suggestion: hit ? `如需释放端口，可先确认进程用途，再运行 taskkill /PID ${hit.pid} /F。` : ''
    };
  });
}

export function resolveWindowsCommand(command, platform = process.platform) {
  if (platform !== 'win32') return command;
  if (command === 'npm' || command === 'npx' || command === 'pnpm' || command === 'yarn') return `${command}.cmd`;
  if (command === 'mvn') return 'mvn.cmd';
  if (command === 'gradle') return 'gradle.bat';
  if (command === 'py') return 'py.exe';
  return command;
}

export function buildCommandInvocation(file, args = [], platform = process.platform) {
  if (platform === 'win32' && /\.(?:cmd|bat)$/i.test(file)) {
    return {
      file: 'cmd.exe',
      args: ['/d', '/c', [file, ...args].map(quoteCmdArg).join(' ')]
    };
  }

  return { file, args };
}

export function buildReport({ platform = process.platform, toolChecks = [], environmentChecks = [], configChecks = [], portChecks = [] }) {
  const report = {
    generatedAt: new Date().toISOString(),
    platform,
    summary: { score: 0, level: 'unknown', title: '未评分' },
    sections: [
      { title: '工具链', items: toolChecks },
      { title: '环境变量', items: environmentChecks },
      { title: '配置检查', items: configChecks },
      { title: '端口占用', items: portChecks.map(portToItem) }
    ]
  };
  report.summary = scoreReport(report);
  return report;
}

export function scoreReport(report) {
  const items = report.sections.flatMap((section) => section.items);
  const total = items.length || 1;
  const value = items.reduce((sum, item) => sum + statusValue(item.status), 0);
  const score = Math.round((value / total) * 100);
  const level = score >= 90 ? 'excellent' : score >= 75 ? 'good' : score >= 60 ? 'needs-attention' : 'critical';
  const title = {
    excellent: '状态优秀',
    good: '整体良好',
    'needs-attention': '需要关注',
    critical: '问题较多'
  }[level];
  return { score, level, title };
}

export function toTextReport(report) {
  const lines = [
    'Windows Dev Doctor 巡检报告',
    `生成时间：${report.generatedAt}`,
    `平台：${report.platform}`,
    `总分：${report.summary.score}/100 - ${report.summary.title}`,
    ''
  ];

  for (const section of report.sections) {
    lines.push(`## ${section.title}`);
    for (const item of section.items) {
      lines.push(`${statusIcon(item.status)} ${item.title ?? item.id}`);
      if (item.detail) lines.push(`   详情：${item.detail}`);
      if (item.suggestion) lines.push(`   建议：${item.suggestion}`);
    }
    lines.push('');
  }

  return lines.join('\n').trimEnd();
}

export function createFixPlan(report) {
  const actions = report.sections
    .flatMap((section) => section.items)
    .filter((item) => item.status !== 'pass' && item.suggestion)
    .map((item) => `${item.title ?? item.id}：${item.suggestion}`);

  if (!actions.length) return '修复计划\n\n暂无必须处理的建议。';

  return [
    '修复计划',
    '',
    ...actions.map((action, index) => `${index + 1}. ${action}`)
  ].join('\n');
}

export function maskPrivateText(value, env = process.env) {
  let text = String(value ?? '');
  const username = env.USERNAME || env.USER || '';
  const profile = env.USERPROFILE || '';

  if (profile) text = replaceAllCaseInsensitive(text, profile, '<USERPROFILE>');
  if (username) text = replaceAllCaseInsensitive(text, username, '<USER>');
  text = text.replace(/C:\\Users\\[^\\\s;]+/gi, 'C:\\Users\\<USER>');
  text = text.replace(/\/Users\/[^/\s;]+/g, '/Users/<USER>');

  return text;
}

export function maskReport(report, env = process.env) {
  return {
    ...report,
    sections: report.sections.map((section) => ({
      ...section,
      items: section.items.map((item) => maskReportItem(item, env))
    }))
  };
}

function parseTasklist(output) {
  const map = new Map();
  for (const line of output.split(/\r?\n/)) {
    const csv = line.match(/^"([^"]+)","?(\d+)"?,/);
    if (csv) {
      map.set(Number(csv[2]), csv[1]);
      continue;
    }
    const plain = line.match(/^(.+?\.(?:exe|com|bat|cmd))\s+(\d+)\s+/i);
    if (plain) map.set(Number(plain[2]), plain[1].trim());
  }
  return map;
}

function extractPort(localAddress) {
  const match = localAddress.match(/:(\d+)$/);
  return match ? Number(match[1]) : null;
}

function portToItem(item) {
  return {
    id: `port-${item.port}`,
    title: `端口 ${item.port}`,
    status: item.status,
    detail: item.detail,
    suggestion: item.suggestion,
    occupied: item.occupied,
    pid: item.pid,
    processName: item.processName
  };
}

function statusValue(status) {
  if (status === 'pass') return 1;
  if (status === 'warn') return 1 / 3;
  return 0;
}

function statusIcon(status) {
  return status === 'pass' ? '[通过]' : status === 'warn' ? '[注意]' : '[失败]';
}

function unique(values) {
  return [...new Set(values)];
}

function isExpandable(value) {
  return /%[^%]+%/.test(value);
}

function quoteCmdArg(value) {
  const text = String(value);
  if (!/[\s"&|<>^]/.test(text)) return text;
  return `"${text.replace(/"/g, '""')}"`;
}

function firstMeaningfulLine(output) {
  return String(output ?? '').split(/\r?\n/).map((line) => line.trim()).find(Boolean) ?? '';
}

function findConfigValue(output, keys) {
  for (const line of String(output ?? '').split(/\r?\n/)) {
    const match = line.trim().match(/^([^=\s]+)\s*=\s*(.+)$/);
    if (match && keys.includes(match[1])) return match[2].trim();
  }
  return '';
}

function replaceAllCaseInsensitive(text, search, replacement) {
  return text.replace(new RegExp(escapeRegExp(search), 'gi'), replacement);
}

function escapeRegExp(value) {
  return String(value).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function maskReportItem(item, env) {
  const masked = { ...item };
  for (const key of ['detail', 'suggestion', 'processName']) {
    if (typeof masked[key] === 'string') masked[key] = maskPrivateText(masked[key], env);
  }
  return masked;
}

#!/usr/bin/env node

import { DEFAULT_PORTS, toTextReport } from './core.js';
import { scanSystem } from './scanner.js';

const args = process.argv.slice(2);

if (args.includes('--help') || args.includes('-h')) {
  printHelp();
  process.exit(0);
}

const json = args.includes('--json');
const ports = parsePorts(args) ?? DEFAULT_PORTS;

try {
  const report = await scanSystem({ ports });
  if (json) {
    console.log(JSON.stringify(report, null, 2));
  } else {
    console.log(toTextReport(report));
  }
  process.exit(report.summary.score >= 60 ? 0 : 2);
} catch (error) {
  console.error(`windows-dev-doctor: ${error.message}`);
  process.exit(1);
}

function parsePorts(values) {
  const arg = values.find((value) => value.startsWith('--ports='));
  if (!arg) return null;
  const ports = arg
    .slice('--ports='.length)
    .split(',')
    .map((value) => Number(value.trim()))
    .filter((value) => Number.isInteger(value) && value > 0 && value <= 65535);
  return ports.length ? ports : DEFAULT_PORTS;
}

function printHelp() {
  console.log(`Windows Dev Doctor

用法：
  windows-dev-doctor
  windows-dev-doctor --json
  windows-dev-doctor --ports=3000,5173,8080

检查内容：
  Git、Node.js、npm、Python、Java、Docker CLI、Docker Engine
  PATH、TEMP、TMP、JAVA_HOME、代理环境变量
  常见开发端口占用情况

退出码：
  0  巡检分数 >= 60
  2  巡检分数 < 60
  1  程序执行错误`);
}

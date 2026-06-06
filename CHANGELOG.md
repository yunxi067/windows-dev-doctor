# Changelog

## Unreleased

- 新增 WSL、pnpm、Yarn、Maven、Gradle 检查。
- 新增 PowerShell 执行策略、npm registry、pip index-url 配置检查。
- 新增 `--privacy` 隐私模式，用于隐藏用户名和本地用户目录。
- 新增 `--fix-plan` 输出，只列出可执行的修复建议。
- 改进 Windows `.bat` 命令调用兼容性。

## 0.1.0 - 2026-06-06

- 初始版本。
- 检查 Git、Node.js、npm、Python、Python Launcher、Java、Docker CLI 和 Docker Engine。
- 检查 PATH、重复 PATH、失效 PATH、TEMP/TMP、JAVA_HOME 和代理变量。
- 检查常见开发端口占用，并关联 PID/进程名。
- 支持中文文本报告、JSON 输出和自定义端口列表。

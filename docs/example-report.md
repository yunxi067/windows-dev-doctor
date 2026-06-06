# 示例报告

下面是一次典型输出示例，真实结果会根据当前机器环境变化。

```text
Windows Dev Doctor 巡检报告
生成时间：2026-06-06T00:00:00.000Z
平台：win32
总分：82/100 - 整体良好

## 工具链
[通过] Git
   详情：git --version -> 2.48.1.windows.1
[通过] Node.js
   详情：node --version -> 24.14.0
[失败] Python
   详情：未检测到 python --version：命令不存在或未加入 PATH
   建议：安装 Python 3：https://www.python.org/downloads/windows/；安装时勾选 Add python.exe to PATH。
[注意] Docker Engine
   详情：未检测到 docker info：Docker daemon is not running
   建议：启动 Docker Desktop，等待引擎就绪后再运行 docker info。
[注意] pnpm
   详情：未检测到 pnpm --version：命令不存在或未加入 PATH
   建议：如需 pnpm，可先运行 corepack enable，再运行 corepack prepare pnpm@latest --activate。

## 环境变量
[通过] PATH 环境变量
   详情：PATH 包含 18 个目录。
[注意] JAVA_HOME
   详情：JAVA_HOME 未配置。
   建议：如果需要 Java 开发，请将 JAVA_HOME 指向 JDK 根目录，并把 %JAVA_HOME%\bin 加入 PATH。

## 配置检查
[注意] PowerShell 执行策略
   详情：ExecutionPolicy=Restricted
   建议：如果 npm/pnpm 脚本无法运行，可在当前用户范围执行 Set-ExecutionPolicy RemoteSigned -Scope CurrentUser。
[通过] npm 镜像源
   详情：registry=https://registry.npmjs.org/
[通过] pip 镜像源
   详情：index-url=https://pypi.tuna.tsinghua.edu.cn/simple

## 端口占用
[注意] 端口 3000
   详情：端口 3000 正被 PID 1234 (node.exe) 占用。
   建议：如需释放端口，可先确认进程用途，再运行 taskkill /PID 1234 /F。
[通过] 端口 5173
   详情：端口 5173 当前空闲。
```

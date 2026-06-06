# 参与贡献

感谢你愿意改进 Windows Dev Doctor。

## 本地开发

```bash
npm install
npm test
node src/cli.js
node src/cli.js --json
```

## 提交建议

- 修改巡检规则时，请优先补测试。
- 新增命令采集时，请设置超时，避免 CLI 卡住。
- 修复建议请保持中文、具体、可执行。
- 不要收集隐私信息，例如完整用户名、token、SSH key、浏览器 Cookie。

## Issue 信息

提交问题时建议包含：

- Windows 版本
- Node.js 版本
- 运行命令
- 相关输出片段
- 你期望看到的结果


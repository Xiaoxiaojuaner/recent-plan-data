# 近期规划

离线优先的 Windows 桌面规划工具。第一阶段以本地 Markdown 为唯一数据源，支持统一任务、首页总览和月历。

## 开发验证

```powershell
pnpm test
pnpm run build
cargo test --manifest-path src-tauri/Cargo.toml
pnpm run tauri dev
```

完整验收步骤见 [TEST_PLAN.md](./TEST_PLAN.md)。

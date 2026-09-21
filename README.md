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

## 本地数据与桌面版

任务、课表和雅思记录保存在 Windows 应用数据目录 `%APPDATA%\com.recentplan.app\data\records`，关闭程序后仍会保留。启动时软件会重新读取这些 Markdown 文件；若某条雅思记录损坏，会显示读取警告并继续加载其他记录。

更新免安装桌面程序时使用 Tauri 的生产构建，以便把前端页面一起打入 exe：

```powershell
pnpm tauri build --no-bundle
Copy-Item -LiteralPath 'src-tauri\target\release\app.exe' -Destination '..\桌面版\近期规划.exe' -Force
```

单独运行 `cargo build --release` 不会生成可离线打开前端页面的成品。

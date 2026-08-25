# 构建与发布

本项目的「部署」= 构建桌面安装包 → 上传到 markitdown-desktop（Web 版）所在服务器 → 由 Web 版 `/download` 端点分发给客户。本项目自身**不在服务器上运行**。

## 一、构建 Windows 包

```bash
cd server-projects/markitdown-electron

# 1. Python 依赖（含 pyinstaller）
cd python && pip install -r requirements.txt && cd ..

# 2. PyInstaller 打包后端 → python/dist/server/server.exe
build_backend.bat

#   （可选）单独冒烟测试后端产物：
python/dist/server/server.exe --port 8877
#   浏览器打开 http://127.0.0.1:8877，能上传转换即 OK

# 3. Electron 构建（win target = "dir"，产出便携目录而非安装器）
pnpm install
pnpm run dist:win
# 输出 dist/win-unpacked/（README 记载约 669MB），直接跑 MarkItDown.exe 验证

# 4. 压成 zip 分发
cd dist
powershell -Command "Compress-Archive -Path 'win-unpacked\*' -DestinationPath 'MarkItDown-1.0.0-win-x64.zip' -Force"
```

> 前置检查：`build/icon.ico` 必须存在（不在仓库里，见 DEVELOPMENT.md 已知坑 #1）。

## 二、构建 macOS 包

前置：macOS 12+、Xcode Command Line Tools（`xcode-select --install`）。

```bash
cd python && pip3 install -r requirements.txt && cd ..
bash build_backend.sh          # 输出 python/dist/server/server（无 .exe）
pnpm install
pnpm run dist:mac
```

输出（package.json mac target = dmg + zip，arch = x64 + arm64）：

- `dist/MarkItDown-1.0.0-arm64.dmg` / `MarkItDown-1.0.0-x64.dmg`
- `dist/MarkItDown-1.0.0-mac-arm64.zip` / `-mac-x64.zip`

**架构限制**：PyInstaller 不支持交叉编译——Apple Silicon 机只能出 arm64、Intel 机只能出 x64。要双架构须两台机器分别构建，或走 CI（GitHub Actions `macos-13` = Intel、`macos-14` = ARM）。只构建本机架构时，把 package.json `build.mac.target` 的 `arch` 数组裁成一个。

**Gatekeeper**：应用未签名（`identity: null`），客户首次打开会被拦。绕过方式：右键 → 打开；或 `xattr -cr /Applications/MarkItDown.app`。正式分发建议购买 Apple Developer ID（$99/年）做签名+公证。

## 三、打包机制要点（electron-builder）

配置全部在 package.json 的 `build` 段，无独立配置文件：

- `files`: 只打 `main.js` + `preload.js`（前端 static/ 不经 Electron 打包，它在 PyInstaller 产物里）。
- `extraResources`: 把 `python/dist/server/` 整目录拷到应用的 `resources/server/`（main.js 运行时从 `process.resourcesPath/server/` 找 exe）；另拷 `build/icon.ico` → `resources/icon.ico`。
- `forceCodeSigning: false`、win `signAndEditExecutable: false`——全平台不签名。
- win target 是 `dir`（便携目录），**没有配 NSIS 安装器 target**（package.json 里的 `nsis` 段目前是死配置，除非把 win target 改成 `nsis` 才生效）。
- 无自动更新机制（未接 electron-updater），升级 = 客户重新下载新包。

## 四、发布链路（上传到下载服务器）

构建产物放到 markitdown-desktop 服务所在服务器上，走 Web 版的 `/download` 端点分发：

```bash
# README 记载的流程（IP/密钥为占位符）：
scp -i your-key.pem dist/MarkItDown-1.0.0-win-x64.zip ubuntu@YOUR_SERVER_IP:/home/ubuntu/markitdown-desktop/
scp -i your-key.pem dist/MarkItDown-1.0.0-arm64.dmg  ubuntu@YOUR_SERVER_IP:/home/ubuntu/markitdown-desktop/
ssh -i your-key.pem ubuntu@YOUR_SERVER_IP "sudo systemctl restart markitdown"
```

- Web 版 `server.py` 中 `DOWNLOAD_FILE` 变量指向 zip 文件路径；换版本号后要同步改它（该文件属于 markitdown-desktop 项目）。
- 验证：客户访问 Web 版页面，顶部出现绿色 **Desktop App** 下载按钮，点击能下到新包。
- **连接信息**（服务器 IP/密钥/域名）：一律见 servers.json（gitignored）。⚠️ 本项目目录当前**没有** servers.json——服务器连接信息在 markitdown-desktop 项目侧维护（它才是常驻服务器的一方）；接手后若需从本项目直接发布，先到那边取用或在本项目补一份 gitignored 的 servers.json（.gitignore 已预排除该文件名）。
- ⚠️ 待确认：README 写的目标路径 `/home/ubuntu/markitdown-desktop/` 与 systemd 服务名 `markitdown` 是否仍与线上实际一致（workspace 线上服务现行惯例是 chi 服务器 + `<name>.bluecatbot.com`，本项目 README 成文可能早于该惯例）。

## 五、发版检查单

1. package.json `version` 更新（当前 1.0.0），产物文件名随之变化。
2. `build/icon.ico` 就位。
3. 重新跑 `build_backend`（别复用旧的 `python/dist/server/` 残留产物）。
4. 本地跑 `dist/win-unpacked/MarkItDown.exe` 冒烟：窗口能开、上传 pdf 能转换、退出后任务管理器无 server.exe 残留。
5. zip 压包 → scp 上传 → restart Web 服务 → 从公网点下载按钮验证。
6. 无 CHANGELOG.md、无 git tag 惯例记录在案。⚠️ 按 workspace 版本管理规范补齐属接手后的改进项。

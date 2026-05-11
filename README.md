# MarkItDown Electron

Document to Markdown Converter - 单机版。基于 Electron 打包，内置 Python 后端（PyInstaller），客户无需安装 Python 环境，下载即用。支持 Windows 和 macOS。

## 项目结构

```
markitdown-electron/
├── main.js                  # Electron 主进程（启动后端、创建窗口、生命周期管理）
├── preload.js               # 预加载脚本
├── package.json             # Electron + electron-builder 配置
├── build_backend.bat        # PyInstaller 打包脚本（Windows）
├── build_backend.sh         # PyInstaller 打包脚本（macOS）
├── static/                  # 前端文件（与 Web 版一致）
│   ├── index.html
│   ├── style.css
│   └── script.js
├── python/
│   ├── server_standalone.py # 合并后的单文件 FastAPI 入口（供 PyInstaller 打包）
│   └── requirements.txt     # Python 依赖
└── dist/                    # 构建输出
```

## 从零构建（Windows）

### 前置条件

- **Node.js** >= 18
- **Python** >= 3.10
- **Windows** x64

### 1. 安装 Python 依赖

```bash
cd markitdown-electron/python
pip install -r requirements.txt
```

### 2. 打包 Python 后端

```bash
cd markitdown-electron
build_backend.bat
```

该脚本会：
- 自动检测 magika 包的安装位置，打包其模型和配置文件
- 使用 PyInstaller `--onedir` 模式打包 `server_standalone.py`
- 输出到 `python/dist/server/server.exe`

打包完成后可单独测试：
```bash
python/dist/server/server.exe --port 8877
# 浏览器打开 http://127.0.0.1:8877
```

### 3. 安装 Node 依赖

```bash
npm install
```

### 4. 开发模式测试

```bash
npm start
```

开发模式下 Electron 会直接调用 `python server_standalone.py`（不依赖 PyInstaller 产物）。

### 5. 构建 Electron 应用

```bash
npm run dist:win
```

输出：
- `dist/win-unpacked/` — 便携版目录（约 669MB），可直接运行 `MarkItDown.exe`

### 6. 打包为 zip 分发

```powershell
cd dist
powershell -Command "Compress-Archive -Path 'win-unpacked\*' -DestinationPath 'MarkItDown-1.0.0-win-x64.zip' -Force"
```

## 从零构建（macOS）

### 前置条件

- **Node.js** >= 18
- **Python 3** >= 3.10（macOS 使用 `python3` / `pip3`）
- **Xcode Command Line Tools**：`xcode-select --install`
- macOS 12+ (Intel x64 或 Apple Silicon arm64)

### 1. 安装 Python 依赖

```bash
cd markitdown-electron/python
pip3 install -r requirements.txt
```

### 2. 打包 Python 后端

```bash
cd markitdown-electron
bash build_backend.sh
```

与 Windows 版的 `build_backend.bat` 功能一致，区别在于：
- `--add-data` 使用 `:` 分隔符（Windows 使用 `;`）
- 使用 `python3` 命令

输出到 `python/dist/server/server`（无 .exe 后缀）。

打包完成后可单独测试：
```bash
python/dist/server/server --port 8877
# 浏览器打开 http://127.0.0.1:8877
```

### 3. 安装 Node 依赖

```bash
npm install
```

### 4. 开发模式测试

```bash
npm start
```

### 5. 构建 Electron 应用

```bash
npm run dist:mac
```

输出：
- `dist/MarkItDown-1.0.0-arm64.dmg` — Apple Silicon DMG 安装包
- `dist/MarkItDown-1.0.0-x64.dmg` — Intel DMG 安装包
- `dist/MarkItDown-1.0.0-mac-arm64.zip` / `MarkItDown-1.0.0-mac-x64.zip`

> **注意**：PyInstaller 不支持交叉编译。在 Apple Silicon Mac 上构建只能生成 arm64 版本，在 Intel Mac 上构建只能生成 x64 版本。如需同时生成两个架构，需在对应机器上分别构建，或使用 CI（GitHub Actions 提供 `macos-13` Intel 和 `macos-14` ARM runner）。
>
> 如果只构建当前机器的架构，修改 `package.json` 中 `build.mac.target` 的 `arch` 数组，例如只保留 `["arm64"]`。

### macOS Gatekeeper 说明

由于应用未签名，macOS 会阻止首次打开。客户可通过以下方式解决：

**方法 1**：右键点击 app → 选择"打开" → 点击"打开"确认

**方法 2**：终端执行
```bash
xattr -cr /Applications/MarkItDown.app
```

如需正式分发，建议购买 Apple Developer ID 证书（$99/年）进行代码签名和公证。

## 部署到服务器供客户下载

将构建好的 zip/dmg 包放到 Web 版服务器上，通过 `/download` 端点提供下载。

### 1. 上传到服务器

```bash
# Windows 版
scp -i your-key.pem dist/MarkItDown-1.0.0-win-x64.zip ubuntu@YOUR_SERVER_IP:/home/ubuntu/markitdown-desktop/

# macOS 版（DMG 或 zip）
scp -i your-key.pem dist/MarkItDown-1.0.0-arm64.dmg ubuntu@YOUR_SERVER_IP:/home/ubuntu/markitdown-desktop/
scp -i your-key.pem dist/MarkItDown-1.0.0-x64.dmg ubuntu@YOUR_SERVER_IP:/home/ubuntu/markitdown-desktop/
```

Web 版的 `server.py` 中 `DOWNLOAD_FILE` 变量指向 zip 文件路径，根据需要可修改为提供多个下载链接。

### 2. 重启 Web 服务

```bash
ssh -i your-key.pem ubuntu@YOUR_SERVER_IP "sudo systemctl restart markitdown"
```

### 3. 验证

客户访问 `http://YOUR_SERVER_IP:8877`，页面顶部会显示绿色的 **Desktop App** 下载按钮。

## 完整构建+部署流程

### Windows 一键操作

```bash
cd markitdown-electron

# 打包 Python 后端
cd python && pip install -r requirements.txt && cd ..
build_backend.bat

# 构建 Electron 应用
npm install
npm run dist:win

# 打包 zip
cd dist
powershell -Command "Compress-Archive -Path 'win-unpacked\*' -DestinationPath 'MarkItDown-1.0.0-win-x64.zip' -Force"
cd ..

# 部署到服务器
scp -i your-key.pem dist/MarkItDown-1.0.0-win-x64.zip ubuntu@YOUR_SERVER_IP:/home/ubuntu/markitdown-desktop/
ssh -i your-key.pem ubuntu@YOUR_SERVER_IP "sudo systemctl restart markitdown"
```

### macOS 一键操作

```bash
cd markitdown-electron

# 打包 Python 后端
cd python && pip3 install -r requirements.txt && cd ..
bash build_backend.sh

# 构建 Electron 应用
npm install
npm run dist:mac

# 部署到服务器
scp -i your-key.pem dist/MarkItDown-1.0.0-arm64.dmg ubuntu@YOUR_SERVER_IP:/home/ubuntu/markitdown-desktop/
ssh -i your-key.pem ubuntu@YOUR_SERVER_IP "sudo systemctl restart markitdown"
```

## 架构说明

```
Electron (main.js)
  ├─ 启动时 spawn python 后端
  │   ├─ Windows: resources/server/server.exe
  │   └─ macOS:   resources/server/server
  ├─ 动态分配空闲端口，传入 --port 参数
  ├─ 轮询 /api/formats 等待后端就绪（最多 30 秒）
  ├─ 创建 BrowserWindow 加载 http://127.0.0.1:{port}
  └─ 退出时 kill python 进程树
      ├─ Windows: taskkill /pid /f /t
      └─ macOS:   SIGTERM
```

- 前端 HTML/CSS/JS 由 Python 后端提供服务，与 Web 版完全一致
- macOS 遵循标准行为：关闭窗口不退出 app，点击 Dock 图标重建窗口
- `python/server_standalone.py` 和 `preload.js` 完全跨平台，无需按系统修改

## NPM 脚本

| 命令 | 说明 |
|------|------|
| `npm start` | 开发模式启动 |
| `npm run build-backend` | Windows 打包 Python 后端 |
| `npm run build-backend:mac` | macOS 打包 Python 后端 |
| `npm run dist` | 构建当前平台 |
| `npm run dist:win` | 构建 Windows 版 |
| `npm run dist:mac` | 构建 macOS 版 |

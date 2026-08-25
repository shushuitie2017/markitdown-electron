# 架构说明

## 技术栈与版本

| 层 | 技术 | 版本来源 |
|----|------|----------|
| 桌面壳 | Electron | `^35.0.0`（package.json devDependencies） |
| 打包器 | electron-builder | `^26.0.0`（devDependencies） |
| Python 后端 | FastAPI + uvicorn + markitdown[all] + python-multipart | `python/requirements.txt`（未 pin 版本） |
| 后端打包 | PyInstaller（`--onedir` 模式） | requirements.txt 中列出，未 pin |
| 前端 | 原生 HTML/CSS/JS（无框架、无构建步骤） | `static/` |
| 应用元数据 | appId `com.markitdown.desktop`，productName `MarkItDown`，版本 `1.0.0` | package.json `build` 段 |

Node 运行时依赖为零（`dependencies` 为空，只有 devDependencies）——运行期所有业务逻辑在 Python 后端和浏览器端。

## 总体架构

```
Electron (main.js)
  ├─ 启动时 getFreePort() 动态分配空闲端口
  ├─ spawn Python 后端，传入 --port
  │   ├─ 生产（app.isPackaged）: resources/server/server(.exe)   ← PyInstaller 产物
  │   └─ 开发: python(.exe)/python3 python/server_standalone.py
  ├─ 轮询 GET /api/formats 等待后端就绪（最多 30 秒，300ms 间隔）
  ├─ BrowserWindow(1000×750, min 600×500) 加载 http://127.0.0.1:{port}
  └─ 退出时杀后端进程树
      ├─ Windows: taskkill /pid {pid} /f /t
      └─ macOS:   SIGTERM
```

前端页面**不是** Electron 本地文件，而是由 Python 后端经 HTTP 提供（与 Web 版行为一致）。

## 分层详解

### 1. 主进程 `main.js`（约 200 行）

职责单一：后端进程生命周期 + 窗口管理。关键函数：

- `getFreePort()` — 用 `net.createServer().listen(0)` 拿一个空闲端口，避免与固定端口冲突。
- `getServerPath()` — `app.isPackaged` 时返回 `process.resourcesPath/server/server(.exe)`；开发模式返回 `null`（走 python 源码）。
- `startServer(port)` — spawn 后端，stdout/stderr 转发到主进程 console（前缀 `[server]`），Windows 下 `windowsHide: true`。
- `waitForServer(port, timeout=30000)` — 轮询 `/api/formats` 到 200 为止。
- `killServer()` — Windows 用 `taskkill /f /t` 杀整棵进程树（PyInstaller onedir 有父子进程），macOS 发 `SIGTERM`。
- 生命周期：`window-all-closed` 时非 macOS 直接杀后端并退出；macOS 遵循平台惯例——关窗不退出，`activate`（点 Dock 图标）时用已存端口重建窗口；`before-quit` 兜底杀后端。
- 非 macOS 平台 `removeMenu()` 去掉菜单栏。

### 2. Preload `preload.js`（6 行）

安全配置：`contextIsolation: true`、`nodeIntegration: false`。当前只经 `contextBridge` 暴露一个字段：

```js
contextBridge.exposeInMainWorld('electronAPI', { platform: process.platform });
```

**没有任何 `ipcMain.handle` / `ipcRenderer` 通道**——渲染端与主进程之间目前零 IPC 业务通信，所有数据交互都走渲染端 → 本地 HTTP（fetch `/api/convert` 等）。这是本项目与 workspace 内其它 Electron 项目（如 ytdl）的显著差异：IPC 面极小。

### 3. Python 后端 `python/server_standalone.py`（约 114 行）

单文件 FastAPI 应用（合并了 Web 版的 server.py + main.py，专供 PyInstaller）：

- **路径解析**：`getattr(sys, "frozen", False)` 判断是否 PyInstaller 冻结环境，是则 `BASE_DIR = sys._MEIPASS`（onedir 下即 `_internal/`），否则取仓库根；`STATIC_DIR = BASE_DIR / "static"`。
- **端点**（共 3 个）：
  - `GET /` → 返回 `static/index.html`
  - `GET /api/formats` → 支持的扩展名清单 + 分类（documents/web/data/media/archive/email）；也被 main.js 用作就绪探针
  - `POST /api/convert`（multipart file）→ 校验扩展名与大小 → 写临时目录 `markitdown_*` → `asyncio.to_thread(converter.convert, path)` → 返回 `{success, filename, markdown, title}`；`finally` 中 `shutil.rmtree` 清理临时目录
- **限制**：`MAX_FILE_SIZE = 50MB`；支持扩展名 20 种（.pdf/.docx/.pptx/.xlsx/.xls/.html/.htm/.csv/.json/.xml/.jpg/.jpeg/.png/.wav/.mp3/.m4a/.zip/.epub/.ipynb/.msg）。
- **入口**：argparse 接收 `--port`（默认 8877）与 `--host`（默认 127.0.0.1），`uvicorn.run(app, ...)`。默认 8877 与 markitdown-desktop 的本地开发端口一致；被 Electron 启动时端口总是动态传入。
- 错误返回走 FastAPI `HTTPException`（400 格式不支持/过大，500 转换失败并带异常类型名）。

### 4. 前端 `static/`

- `index.html`（119 行）— 单页：拖拽区 → 文件信息 → Convert 按钮 → loader/error → 输出区（Preview / Raw Markdown 两个 tab + Copy / Save .md / Convert Another）。
- `script.js`（487 行）— IIFE 封装：客户端先做扩展名与 50MB 双重预校验（与后端常量重复定义，改限制要两处同步），fetch 上传，Markdown 渲染，保存时用 `a.download = baseName + '.md'`。
- `style.css`（626 行）。
- 注意：界面**仅英文**，未做 workspace 规范的 en/zh/ja 三语（历史遗留，页脚标注 Powered by Microsoft MarkItDown）。

### 5. PyInstaller 打包层

- `build_backend.bat` / `build_backend.sh` — 双平台等价脚本：先用 `python -c "import magika..."` 探测 magika 包位置，把其 `models/` 与 `config/` 以及 `../static` 用 `--add-data` 塞进包；再加一长串 uvicorn 子模块 `--hidden-import`（uvicorn 动态 import，PyInstaller 静态分析发现不了）；`--onedir --name server`，输出 `python/dist/server/`。
- `python/server.spec` — PyInstaller 自动生成的 spec，内含本机绝对路径（site-packages 位置），**机器相关、已被 .gitignore（`python/*.spec`）排除**，不要手改它当配置源，真相源是两个 build 脚本。

## 数据流（一次转换）

```
用户拖文件 → script.js 预校验(扩展名/50MB) → fetch POST /api/convert (multipart)
  → FastAPI 校验 → 临时目录落盘 → markitdown 库转换（线程池内）
  → JSON {markdown, title} → 前端渲染 Preview/Raw → Copy 或 Save .md → 临时目录已清理
```

## 安全面

- 后端只绑 `127.0.0.1`，端口随机，仅本机可访问。
- 渲染进程 `contextIsolation: true` + `nodeIntegration: false`，无 Node 能力泄漏。
- 无任何密钥/凭据/License 系统（与 ytdl 系不同，本应用完全离线免费）。
- `.claude/rules.json` 配有 project-guard 拦截（禁 scp 外泄 .env/.pem 等、禁 git add .env/config.json）。

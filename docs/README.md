# markitdown-electron 接手文档 · 导读

> 面向新接手者的文档套件。以仓库实际代码为准（本套文档基于 2026-07-12 的仓库快照编写）。

## 这个项目是什么

**MarkItDown Electron** 是「文档转 Markdown 转换器」的**单机桌面版**：用 Electron 打包一个内置的 Python 后端（PyInstaller 产物），客户下载解压即用，无需安装 Python。支持 Windows 和 macOS。

- 后端：单文件 FastAPI 服务 `python/server_standalone.py`，核心转换能力来自微软开源库 [markitdown](https://github.com/microsoft/markitdown)。
- 前端：`static/` 下的原生 HTML/CSS/JS，由 Python 后端直接提供服务（拖拽上传 → 转换 → 预览/复制/保存 .md）。
- 壳：Electron 主进程 `main.js` 负责启动/守护/杀掉后端进程，并把窗口指向本地 HTTP 服务。

## 与 markitdown-desktop 的关系（重要）

同目录下另有 `server-projects/markitdown-desktop`，那是部署在服务器上的 **Web 版 FastAPI 服务端**（本地开发端口 8877，见 workspace 根 `CLAUDE.md` 端口表）。二者关系：

- 本项目（markitdown-electron）**构建桌面下载包**（Windows zip / macOS dmg）。
- 构建产物上传到 markitdown-desktop 所在服务器，由 Web 版的 `/download` 端点分发给客户（Web 页面顶部显示 "Desktop App" 下载按钮）。
- 本项目的 `python/server_standalone.py` 是 Web 版 `server.py + main.py` 合并成的单文件版本（便于 PyInstaller 打包）；`static/` 前端与 Web 版一致。改 Web 版功能后如需同步到桌面版，须手动同步这两处。⚠️ 待确认：两边是否已经漂移，接手后建议 diff 一次。

markitdown-desktop 本身的部署/运维请看该项目自己的文档，本套文档不越界。

## 文档地图

| 文件 | 内容 |
|------|------|
| [ARCHITECTURE.md](ARCHITECTURE.md) | 技术栈与版本、Electron 主进程/preload/前端/Python 后端分层、进程生命周期、API |
| [DIRECTORY.md](DIRECTORY.md) | 目录树逐项说明 |
| [DEVELOPMENT.md](DEVELOPMENT.md) | 环境要求、依赖安装、开发模式启动、已知坑 |
| [DEPLOYMENT.md](DEPLOYMENT.md) | PyInstaller + electron-builder 构建打包全流程、发布到下载服务器的链路 |

## 快速上手（最短路径）

```bash
cd server-projects/markitdown-electron

# 1. Python 依赖（后端开发模式直接跑源码，不需要先打 PyInstaller 包）
cd python && pip install -r requirements.txt && cd ..

# 2. Node 依赖（workspace 全局规范要求 pnpm，README 原文写的是 npm，命令等价换用）
pnpm install

# 3. 开发模式启动（Electron 直接 spawn `python server_standalone.py`）
pnpm start
```

## 现状一句话

代码结构完整、README 详尽、构建脚本双平台齐备；版本 1.0.0；`python/dist/server/` 里已有一份 Windows PyInstaller 产物。无 CLAUDE.md、无 HANDOFF.md、无 servers.json（部署连接信息见 DEPLOYMENT.md 的说明）。

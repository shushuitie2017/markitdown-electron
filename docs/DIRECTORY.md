# 目录结构逐项说明

```
markitdown-electron/
├── main.js                  # Electron 主进程：动态端口 + spawn/杀 Python 后端 + 窗口管理（详见 ARCHITECTURE.md）
├── preload.js               # 预加载脚本：仅暴露 electronAPI.platform，无 IPC 通道
├── package.json             # name=markitdown v1.0.0；scripts + electron-builder 完整 build 配置都在这里
├── package-lock.json        # npm 时代锁文件（workspace 现行规范用 pnpm，首次 pnpm install 会生成 pnpm-lock.yaml）
├── README.md                # 项目自带的构建/部署手册（内容详尽，双平台从零构建 + 上传服务器流程）
├── build_backend.bat        # Windows 版 PyInstaller 打包脚本（magika 数据探测 + hidden-import 清单）
├── build_backend.sh         # macOS 版同上（--add-data 分隔符 ; → :，python → python3）
├── .gitignore               # 排除 node_modules/dist/python产物/.env/servers.json/*.pem/credentials.* 等
│
├── assets/                  # ⚠️ 当前为空目录，用途待确认（未被 package.json 或代码引用）
│
├── static/                  # 前端（由 Python 后端 serve，与 Web 版 markitdown-desktop 一致）
│   ├── index.html           # 单页 UI：拖拽上传 → 转换 → Preview/Raw 双 tab 输出（119 行，仅英文）
│   ├── script.js            # 全部前端逻辑：预校验/上传/渲染/复制/保存（487 行，IIFE）
│   └── style.css            # 样式（626 行）
│
├── python/                  # Python 后端
│   ├── server_standalone.py # 单文件 FastAPI 入口（3 端点），Web 版 server.py+main.py 的合并版，供 PyInstaller
│   ├── requirements.txt     # markitdown[all] / fastapi / uvicorn / python-multipart / pyinstaller（均未 pin 版本）
│   ├── server.spec          # PyInstaller 自动生成（含本机绝对路径），已被 gitignore，勿当配置真相源
│   ├── build/               # PyInstaller 中间产物（gitignored）
│   └── dist/
│       └── server/          # PyInstaller --onedir 输出：server.exe + _internal/（gitignored；electron-builder 从这里取 extraResources）
│
├── dist/                    # electron-builder 输出（gitignored）：win-unpacked/ 便携目录、dmg、zip
│
└── .claude/                 # claude-flow 播的项目内 Claude 配置
    ├── rules.json           # project-guard 硬规则（禁外泄 .env/.pem、禁 git add 凭据文件）
    ├── settings.json / settings.local.json（local 已 gitignore）
    ├── hooks/ · skills/ · memory/MEMORY.md（记忆切片，当前为空）
    └── flow.json
```

## 关键说明

- **没有 CLAUDE.md / HANDOFF.md / servers.json**：项目知识目前只在根 README.md 与本 docs/ 套件里；部署连接信息见 [DEPLOYMENT.md](DEPLOYMENT.md)。
- **package.json 里引用了 `build/icon.ico`**（`build.directories.buildResources: "build"`、`build.win.icon`、`extraResources`，以及 main.js 的窗口图标路径），但仓库根**不存在 `build/` 目录**。⚠️ 待确认：icon 是构建机上的本地未入库文件，还是已丢失——当前状态下跑 `dist:win` 可能因 extraResources 找不到 `build/icon.ico` 而失败，接手后第一次构建前先确认/补上这个文件。
- **`python/dist/server/` 当前有一份现成的 Windows 产物**（server.exe + _internal/），是历史构建残留，可直接 `server.exe --port 8877` 冒烟测试，但正式构建前建议重打以保证与源码一致。
- `static/` 与 markitdown-desktop（Web 版）的前端「应当一致」，但无自动同步机制，改动须手动双向同步。

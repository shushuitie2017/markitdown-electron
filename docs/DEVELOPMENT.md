# 开发指南

## 环境要求

| 依赖 | 要求 | 备注 |
|------|------|------|
| Node.js | >= 18（README 要求；workspace 现行标准 22+） | |
| Python | >= 3.10 | Windows 用 `python`，macOS 用 `python3`（main.js 按平台自动选） |
| 包管理器 | **pnpm**（workspace 硬性规则） | README 原文写 npm，执行时等价替换；仓库现存 package-lock.json 是 npm 时代产物，首次 `pnpm install` 会自动迁移生成 pnpm-lock.yaml |
| PyInstaller | 随 requirements.txt 安装 | 仅构建分发包时需要，日常开发不需要 |

## 安装依赖

```bash
cd server-projects/markitdown-electron

# Python 依赖
cd python
pip install -r requirements.txt        # macOS: pip3
cd ..

# Node 依赖（只有 electron / electron-builder 两个 devDependencies）
pnpm install
```

## 启动开发模式

```bash
pnpm start        # = electron .
```

开发模式下（`app.isPackaged === false`）Electron 会直接 `spawn python python/server_standalone.py --port <随机端口>`，**不依赖 PyInstaller 产物**——改 Python 代码后重启 Electron 即生效。

后端也可以脱离 Electron 单独跑（方便用浏览器/curl 调试 API）：

```bash
python python/server_standalone.py --port 8877
# 浏览器打开 http://127.0.0.1:8877
```

> 注意：8877 是后端 argparse 的默认端口，与同 workspace 的 markitdown-desktop（Web 版）本地开发端口相同，两者别同时用默认端口跑。Electron 启动时总是传随机端口，无此冲突。

## NPM scripts 一览（用 pnpm 执行）

| 命令 | 说明 |
|------|------|
| `pnpm start` | 开发模式启动 Electron |
| `pnpm build-backend` | Windows 打包 Python 后端（= build_backend.bat） |
| `pnpm run build-backend:mac` | macOS 打包 Python 后端（= bash build_backend.sh） |
| `pnpm dist` | electron-builder 构建当前平台 |
| `pnpm run dist:win` | 构建 Windows 版 |
| `pnpm run dist:mac` | 构建 macOS 版 |

## 常见修改点

- **加支持格式**：`server_standalone.py` 的 `SUPPORTED_EXTENSIONS` + `/api/formats` 的 categories + `static/script.js` 的 `ALLOWED_EXTENSIONS` + `static/index.html` 的 `<input accept=...>`——**四处要同步**（前后端常量是重复定义的）。
- **改大小限制**：后端 `MAX_FILE_SIZE` 与前端 `script.js` 的同名常量，两处同步。
- **改前端**：`static/` 与 Web 版 markitdown-desktop 前端「应当一致」，改完记得手动同步另一边。
- **发新版本**：package.json `version` + README 中的产物文件名（如 `MarkItDown-1.0.0-win-x64.zip`）一起改。

## 已知坑

1. **`build/icon.ico` 不在仓库里**：package.json 与 main.js 都引用它，但根目录没有 `build/`。构建前必须先放好这个文件，否则 electron-builder 的 extraResources 会失败。⚠️ 待确认其来源（见 DIRECTORY.md）。
2. **uvicorn hidden-import**：PyInstaller 静态分析发现不了 uvicorn 的动态 import，build 脚本里那串 `--hidden-import uvicorn.*` 一个都不能少，否则打出的 exe 启动即崩。新增动态 import 的库时照此补。
3. **magika 数据文件**：markitdown[all] 依赖 magika（文件类型识别），其 models/config 必须 `--add-data` 进包——build 脚本已自动探测 site-packages 位置，换 Python 环境后无需手改。
4. **PyInstaller 用 `--onedir` 不用 `--onefile`**（workspace 通用规范，启动快且便于排查）；产物是 `server.exe + _internal/` 整个目录，electron-builder 按目录整体拷贝。
5. **杀进程必须杀树**：Windows 下 PyInstaller onedir 有父子进程，main.js 已用 `taskkill /f /t`；自己手动测试后端后残留进程也照此清（PowerShell `Stop-Process`，别用 Git Bash 管道 taskkill）。
6. **PyInstaller 不能交叉编译**：在什么架构的机器上就只能打什么架构的包（详见 DEPLOYMENT.md）。
7. **`python/server.spec` 是生成物**：内含本机绝对路径，已被 gitignore；改打包参数应改 `build_backend.bat/.sh`，不要改 spec。
8. **开发模式依赖 PATH 里的 `python`/`python3`**：Windows 若装的是 Store 版 Python 别名可能行为异常，确保 `python -c "import markitdown"` 能过再 `pnpm start`。
9. **前端仅英文**：未做 workspace 的 en/zh/ja 三语规范，若要补三语属于新功能（历史遗留，非 bug）。
10. **无自动化测试**：仓库没有任何测试脚本，验证靠手动冒烟（上传一个 pdf/docx 转换成功即通过）。

# 真实报错与调试过程记录

## 一：PowerShell 禁止运行脚本

- **报错信息**：npx : 无法加载文件，因为在此系统上禁止运行脚本。FullyQualifiedErrorId : UnauthorizedAccess
- **运行命令**：npx --yes create-vite@latest frontend --template react-ts
- **AI 修复方案**：运行 Set-ExecutionPolicy -Scope Process -ExecutionPolicy Bypass 临时解除 Windows 限制。
- **最终结果**：成功初始化 Vite 项目。

## 二：AI 误跑命令覆盖前端核心代码

- **现象**：AI 失忆后偷偷运行 create-vite，覆盖了 App.tsx 和 index.css，页面变成 Vite 默认模板。
- **AI 修复方案**：利用 VS Code 自带的“时间线（Timeline）”功能，右键旧记录进行还原，成功找回所有组件代码。

## 三：前端白屏，控制台报 500 错误

- **报错信息**：Failed to load resource: the server responded with a status of 500 (Internal Server Error) index.css:1
- **AI 修复方案**：手动重写 vite.config.ts 引入 @tailwindcss/vite，重置 index.css 为 @import "tailwindcss";。
- **最终结果**：执行依赖安装，Vite 自动切换至 5178 端口，页面成功恢复。

## 四：版本冲突引发功能丢失，全量重写

- **现象**：深色模式丢失、标签点击无效、存在超大黑球图片。
- **AI 修复方案**：用极度严厉的提示词严格约束 AI（绝对禁止运行终端命令，只允许输出全量代码文本），完成对 App.tsx、ArticleDetail.tsx、index.css 的全量重写。
- **最终结果**：前端彻底复活，前后端 API 完美联调。

## 环境遗留问题记录：本地端口冲突导致 Failed to fetch

- **现象**：演示阶段由于端口占用，Vite 切换至 5179 端口。前端页面触发 Failed to fetch。
- **排查过程**：确认后端 Swagger 运行正常且 SQLite 数据完好。判定为端口变更引发的跨域或本地防火墙拦截。
- **前端容错表现**：前端已实装完善的错误兜底 UI（显示“文章暂时无法加载”及“重新加载”按钮，而非白屏），证明了组件的健壮性。
- **处理决定**：属于本地环境配置冲突，非核心逻辑错误。为保护已稳定的全栈结构，决定保留此遗留问题，不再强行修改。

## 犹豫了一下决定修复

在清理了所有终端后，重新启动前后端。后端终端输出 `200 OK`，前端页面成功渲染从 SQLite 读取的真实文章数据。前后端全栈闭环彻底打通，项目顺利完成交付。

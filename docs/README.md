# 个人博客全栈项目（VibeCoding 大实战）

## 项目简介
基于 React + TypeScript + Vite 和 Python + FastAPI + SQLite 开发的个人博客全栈项目，包含完整的前后端增删改查与数据持久化。

## 技术栈
- 前端：React + TypeScript + Vite + Tailwind CSS
- 后端：Python + FastAPI + SQLite

## 启动命令
### 前端
cd frontend
npm install
npm run dev

### 后端
cd backend
pip install -r requirements.txt
uvicorn main:app --reload

## 项目结构
VibeCoding/
├── frontend/    # React 前端代码
├── backend/     # FastAPI 后端代码（包含 blog.db 数据库）
└── docs/        # 协作记录与审计报告

## 已实现功能
### 前端（6 个核心模块 + 完整 CRUD）
1. 全局导航与深色/浅色主题切换（带持久化）
2. 文章列表（卡片式布局、分页、骨架屏、悬停动效）
3. 文章详情（Markdown 渲染、代码高亮、阅读进度条、图片懒加载）
4. 搜索与分类（防抖搜索、多选标签过滤）
5. 评论与互动（前端校验、点赞数字动画、Toast 通知）
6. 数据持久化（localStorage 保存点赞/评论/主题偏好，支持重置）
- 加分项：前端实现了“写文章”与“删除文章”的交互，打通前后端闭环。

### 后端（6 个最低功能 + 加分项）
1. 查看文章列表（支持分页、标题关键词搜索）
2. 查看文章详情
3. 创建文章
4. 修改文章
5. 删除文章
6. 数据持久化（SQLite，重启不丢）
- 加分项：文章标签管理、增加统一的错误返回格式（统一包装为 {code, message, data}，通过自定义异常处理捕获 422 等错误、输入校验、Swagger API 文档。

## 数据存储位置和重置方法
- 前端数据：浏览器 localStorage（用户偏好、点赞状态）。
- 后端数据：`backend/blog.db`（SQLite数据库，重启不丢）。

## 访问地址（最终验证状态）
- 前端：http://localhost:5173
- 后端 API：http://127.0.0.1:8000
- Swagger 文档：http://127.0.0.1:8000/docs

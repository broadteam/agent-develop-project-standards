# Node.js / JavaScript / TypeScript 技术栈约定

- 包管理器以 lock 文件为准，使用对应的 npm/pnpm/yarn/bun 命令；不要混用包管理器重写 lock 文件。
- 优先遵循项目已有的 TypeScript、ESLint、Prettier、测试框架和模块系统配置。
- TypeScript 项目优先启用 strict；外部数据先验证再进入领域逻辑。避免无边界的 `any`。
- 不为局部功能引入第二套状态管理、HTTP 客户端、日期库或构建工具，除非有明确 ADR。
- 前端代码不得把服务端密钥打包到客户端；服务端不得信任客户端传入的租户、角色或权限上下文。
- 执行项目已配置的 lint、typecheck、test 和 build；未配置的检查标记为未执行。

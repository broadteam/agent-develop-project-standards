# .NET 技术栈约定

- SDK、TargetFramework 和 Nullable 配置以仓库声明为准；不要擅自升级目标框架。
- 依赖通过 NuGet 与项目文件管理；新增包前检查许可证、漏洞、维护状态及传递依赖。
- 遵循项目已有的 DI、配置、日志、异步和取消令牌约定。
- 避免 `.Result` / `.Wait()` 阻塞异步调用链；正确传递 `CancellationToken`。
- 优先执行 `dotnet format --verify-no-changes`、`dotnet build`、`dotnet test`。

# Go 技术栈约定

- Go 版本以 `go.mod` 为准；依赖通过 Go Modules 管理，不手工修改 module cache。
- 遵循标准 Go 项目布局与现有包边界；避免为了复用而形成循环依赖。
- 错误作为显式返回值处理；添加上下文时保留可检查的错误链，不忽略错误返回。
- 并发代码必须说明 goroutine 生命周期、取消机制、共享状态保护与资源释放。
- 优先执行 `gofmt`、`go vet ./...`、`go test ./...`，必要时运行 race detector。

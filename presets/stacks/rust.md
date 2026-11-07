# Rust 技术栈约定

- Rust 工具链与 edition 以 `rust-toolchain.toml`、`Cargo.toml` 为准。
- 依赖通过 Cargo 管理；修改依赖时检查 feature、许可证、维护状态和 `Cargo.lock` 策略。
- 优先使用类型系统表达状态与约束；避免无必要的 `unwrap`、`expect` 和不安全代码。
- 新增 `unsafe` 必须说明安全不变量、调用前提，并添加针对性测试。
- 优先执行 `cargo fmt --check`、`cargo clippy -- -D warnings`、`cargo test`。

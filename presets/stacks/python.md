# Python 技术栈约定

- Python 版本以 `pyproject.toml`、运行时配置和 CI 为准；优先使用项目锁定的 uv/Poetry/pip 工作流。
- 依赖必须通过项目声明文件管理；不要手工修改虚拟环境或提交缓存、构建目录。
- 遵循项目已有的类型标注、ruff/black、mypy/pyright 和 pytest 配置。
- 对文件、网络、环境变量、数据库及消息输入进行边界校验；避免裸 `except` 和静默吞错。
- 新增依赖前检查许可证、维护状态、安全公告和 Python 版本兼容性。
- 执行项目已有的 lint、typecheck、test 和 build；未执行项明确标记。

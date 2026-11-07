# PHP 技术栈约定

> 通用 PHP 基线。框架特有约束由项目补充，不要假设 Laravel、ThinkPHP、Hyperf 等框架可以互换。

- 依赖通过 Composer 管理；提交 `composer.json` 与适用的 lock 文件，不手工修改 `vendor/`。
- 遵循项目已采用的 PHP 版本、PSR 标准和自动格式化配置；不要为了局部改动擅自升级 PHP 运行时基线。
- 对外部输入、HTTP 请求、MQTT 消息、队列载荷和反序列化数据进行边界校验。
- 数据库访问遵循项目既有 Repository / ORM / Query 约定；禁止跨模块直接访问其他模块的内部 Model、Repository 或 Service。
- 新增依赖前检查维护状态、许可证、安全公告、PHP 版本兼容性及替代方案。
- 优先运行项目已配置的 PHPStan/Psalm、PHP-CS-Fixer/Pint、PHPUnit/Pest；未配置时明确标记未执行，不得声称通过。
- 不在源码中硬编码密钥、数据库凭据、租户标识或环境专属地址。

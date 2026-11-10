"""Project profile validator; standard-library only and behavior-compatible with JS."""
from __future__ import annotations
import json
import re
from pathlib import Path

ENUMS = {
    "profile.status": ["needs_review", "confirmed"],
    "profile.type": ["web", "api", "saas", "desktop", "mobile", "library", "cli", "monorepo", "other", "unknown"],
    "profile.scale": ["small", "medium", "large", "unknown"],
    "profile.risk": ["low", "medium", "high", "critical", "unknown"],
    "profile.architecture": ["modular_monolith", "layered", "microservices", "event_driven", "monolith", "other", "unknown"],
}

def parse_profile(source: str) -> dict:
    data: dict[str, dict] = {}
    section = ""
    for number, raw in enumerate(source.splitlines(), 1):
        line = raw.strip()
        if not line or line.startswith("#"):
            continue
        match = re.fullmatch(r"\[([\w.-]+)\]", line)
        if match:
            section = match.group(1)
            if section in data:
                raise ValueError(f"第 {number} 行重复 section：[{section}]")
            data[section] = {}
            continue
        match = re.fullmatch(r'([\w.-]+)\s*=\s*(.*?)\s*(?:#.*)?', line)
        if not match or not section:
            raise ValueError(f"第 {number} 行 TOML 子集语法不受支持：{line}")
        key, value = match.groups()
        if key in data[section]:
            raise ValueError(f"第 {number} 行重复键：{section}.{key}")
        if re.fullmatch(r'".*"', value):
            data[section][key] = value[1:-1]
        elif re.fullmatch(r"\d+", value):
            data[section][key] = int(value)
        elif re.fullmatch(r'\[(?:\s*"[^"]*"\s*(?:,\s*"[^"]*"\s*)*)?\]', value):
            data[section][key] = re.findall(r'"([^"]*)"', value)
        else:
            raise ValueError(f"第 {number} 行值类型不受支持：{section}.{key}")
    return data

def validate_profile(root: Path) -> tuple[list[str], list[str]]:
    errors: list[str] = []
    warnings: list[str] = []
    profile_path = root / "project-profile.toml"
    registry_path = root / "policy" / "capabilities.json"
    if not profile_path.exists():
        return ["缺少 project-profile.toml"], warnings
    if not registry_path.exists():
        return ["缺少 policy/capabilities.json（能力注册表）"], warnings
    try:
        profile = parse_profile(profile_path.read_text(encoding="utf-8"))
    except Exception as exc:
        return [f"project-profile.toml：{exc}"], warnings
    try:
        registry = json.loads(registry_path.read_text(encoding="utf-8"))
    except Exception as exc:
        return [f"policy/capabilities.json 无法解析：{exc}"], warnings

    expected = {
        "profile": ["schema_version", "status", "name", "description", "type", "scale", "risk", "architecture"],
        "stack": ["detected", "primary", "framework", "package_manager"],
        "capabilities": list(registry.get("capabilities", {}).keys()),
        "verification": ["lint", "typecheck", "test", "build", "ci"],
    }
    for section, keys in expected.items():
        if section not in profile:
            errors.append(f"project-profile.toml 缺少 [{section}]")
            continue
        for key in keys:
            if key not in profile[section]:
                errors.append(f"project-profile.toml 缺少 {section}.{key}")
        for key in profile[section]:
            if key not in keys:
                errors.append(f"project-profile.toml 存在未知字段：{section}.{key}")
    for section in profile:
        if section not in expected:
            errors.append(f"project-profile.toml 存在未知 section：[{section}]")

    if "profile" in profile:
        if profile["profile"].get("schema_version") != registry.get("schema_version"):
            errors.append(f"画像 schema_version 不匹配：{profile['profile'].get('schema_version')}，注册表要求 {registry.get('schema_version')}")
        for field, values in ENUMS.items():
            section, key = field.split(".")
            if section in profile and key in profile[section] and profile[section][key] not in values:
                errors.append(f"非法枚举值：{field} = {profile[section][key]}（允许：{', '.join(values)}）")
        if profile["profile"].get("status") == "needs_review":
            warnings.append("项目画像尚未确认（needs_review）；探测值不得作为已确认项目事实。")
        if profile["profile"].get("status") == "confirmed":
            for field in ["type", "scale", "risk", "architecture"]:
                if profile["profile"].get(field) == "unknown":
                    errors.append(f"画像已标记 confirmed，但 profile.{field} 仍为 unknown")
    if "stack" in profile:
        for key in ["primary", "framework", "package_manager"]:
            if not isinstance(profile["stack"].get(key), str):
                errors.append(f"stack.{key} 必须是字符串")
        detected = profile["stack"].get("detected")
        if not isinstance(detected, list) or any(not isinstance(v, str) for v in detected):
            errors.append("stack.detected 必须是字符串数组")
        elif not detected:
            errors.append('stack.detected 不能为空；未知技术栈请使用 ["generic"]')
    if "capabilities" in profile:
        capabilities = profile["capabilities"]
        for name, definition in registry.get("capabilities", {}).items():
            value = capabilities.get(name)
            if value is not None and value not in definition.get("values", []):
                errors.append(f"非法能力配置：capabilities.{name} = {value}（允许：{', '.join(definition.get('values', []))}）")
        if capabilities.get("roadmap") == "on" and capabilities.get("task_tracking") == "off":
            errors.append("能力依赖冲突：roadmap=on 要求 task_tracking 不得为 off")
        if capabilities.get("stack_rules") == "on" and all(v == "generic" for v in profile.get("stack", {}).get("detected", [])):
            errors.append("stack_rules=on 要求至少一个已确认的非 generic 技术栈")
        if capabilities.get("release_governance") == "strict" and capabilities.get("quality_gates") == "baseline":
            errors.append("release_governance=strict 要求 quality_gates 为 standard 或 strict")
        verification = profile.get("verification", {})
        if capabilities.get("quality_gates") == "strict" and not any(isinstance(verification.get(k), str) and verification[k].strip() for k in ["lint", "test", "build"]):
            errors.append("quality_gates=strict 至少需要配置 lint、test、build 中一项适用的验证命令")
    if "verification" in profile:
        for key in expected["verification"]:
            if not isinstance(profile["verification"].get(key), str):
                errors.append(f"verification.{key} 必须是字符串")
    return errors, warnings

def resolve_capabilities(profile: dict, registry: dict) -> dict:
    configured = profile.get("capabilities", {})
    resolved: dict[str, dict[str, str]] = {}
    errors: list[str] = []
    excluded_paths: list[str] = []
    for name, definition in registry.get("capabilities", {}).items():
        value = configured.get(name, definition.get("default"))
        if value not in definition.get("values", []):
            errors.append(f"非法能力配置：capabilities.{name} = {value}")
            continue
        kind = definition.get("kind")
        status = "enabled" if kind == "profile" or value == "on" else "disabled" if value == "off" else "deferred"
        resolved[name] = {"configured": value, "status": status}
        if status == "disabled":
            excluded_paths.extend(definition.get("artifacts", []))
    for name, definition in registry.get("capabilities", {}).items():
        item = resolved.get(name)
        dependency = definition.get("requires")
        if not item or item["status"] == "disabled" or not dependency or item["configured"] != dependency.get("when"):
            continue
        target = resolved.get(dependency.get("capability"))
        if not target or target["configured"] == dependency.get("not"):
            errors.append(f"能力依赖冲突：{name}={item['configured']} 要求 {dependency.get('capability')} 不得为 {dependency.get('not')}")
    return {"capabilities": resolved, "excluded_paths": list(dict.fromkeys(excluded_paths)), "errors": errors}

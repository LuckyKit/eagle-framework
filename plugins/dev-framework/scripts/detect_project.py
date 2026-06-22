#!/usr/bin/env python3
"""
Eagle Framework - Session Start Hook
会话启动时检测当前项目类型，向 Claude 注入上下文。
"""
import os
import sys
import json

def detect_stack(project_root: str) -> list[str]:
    stacks = []
    if os.path.exists(os.path.join(project_root, "backend", "go.mod")):
        stacks.append("go")
    if os.path.exists(os.path.join(project_root, "web", "package.json")):
        stacks.append("react")
    if os.path.exists(os.path.join(project_root, "mobile", "pubspec.yaml")):
        stacks.append("flutter")
    return stacks

def main():
    project_root = os.getcwd()
    dev_dir = os.path.join(project_root, ".dev")

    if not os.path.exists(dev_dir):
        # 不是 Eagle 框架项目，静默退出
        sys.exit(0)

    stacks = detect_stack(project_root)
    stack_str = " + ".join(s.capitalize() for s in stacks) if stacks else "未知"

    rules_hint = ""
    for stack in stacks:
        rules_path = os.path.join(dev_dir, "rules", stack, "INDEX.md")
        if os.path.exists(rules_path):
            rules_hint += f"\n- {stack} 规范：.dev/rules/{stack}/INDEX.md"

    message = f"""
🦅 Eagle Framework 项目已检测

**技术栈**：{stack_str}
**编码规范**：{rules_hint if rules_hint else "尚未初始化"}
**知识库**：.dev/knowledge/
**记忆库**：.dev/memory/
**组件库**：.dev/components/

可用命令：/new-project /discuss /dev /fix /refactor
"""
    print(message)

if __name__ == "__main__":
    main()

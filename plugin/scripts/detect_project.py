#!/usr/bin/env python3
"""
Eagle Framework - Session Start Hook

Detects an Eagle-enabled project and injects a compact orientation message.
"""
import os
import sys


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
    eagle_dir = os.path.join(project_root, ".eagle")

    if not os.path.exists(eagle_dir):
        sys.exit(0)

    stacks = detect_stack(project_root)
    stack_str = " + ".join(s.capitalize() for s in stacks) if stacks else "unknown"

    rules_hint = ""
    for stack in stacks:
        rules_path = os.path.join(eagle_dir, "rules", stack, "INDEX.md")
        if os.path.exists(rules_path):
            rules_hint += f"\n- {stack}: .eagle/rules/{stack}/INDEX.md"

    message = f"""
Eagle Framework project detected

Stack: {stack_str}
Rules:{rules_hint if rules_hint else " not initialized"}
Lifecycle: .eagle/PROJECT.md / .eagle/ROADMAP.md / .eagle/STATE.md
Codebase map: .eagle/codebase/
Quality gates: .eagle/gates/QUALITY-GATES.md
Knowledge: .eagle/knowledge/
Memory: .eagle/memory/
Components: .eagle/components/

Useful commands: /new-project /discuss /dev /fix /refactor /map-codebase /gate /memory /config /lifecycle
"""
    print(message)


if __name__ == "__main__":
    main()

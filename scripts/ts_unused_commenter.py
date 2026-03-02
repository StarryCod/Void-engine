#!/usr/bin/env python3
"""
ts_unused_commenter.py

Find TypeScript "unused" diagnostics and optionally comment the matching source lines.

Default mode is dry-run:
  python scripts/ts_unused_commenter.py

Apply changes:
  python scripts/ts_unused_commenter.py --apply

Use existing compiler log:
  python scripts/ts_unused_commenter.py --log-file compile.log --apply
"""

from __future__ import annotations

import argparse
import dataclasses
import pathlib
import re
import subprocess
import sys
from collections import defaultdict
from typing import Dict, Iterable, List, Optional, Tuple


ANSI_RE = re.compile(r"\x1b\[[0-9;]*m")
UNUSED_VALUE_RE = re.compile(r"'([^']+)' is declared but its value is never read\.")
TS_ERROR_LINE_RE = re.compile(
    r"^(?:Error:\s*)?(?P<file>.+?)\((?P<line>\d+),(?P<col>\d+)\):\s*(?P<msg>.+?)\s*$"
)

# Example:
# src/file.ts(12,8): error TS6133: 'x' is declared but its value is never read.
TS_NATIVE_LINE_RE = re.compile(
    r"^(?P<file>.+?)\((?P<line>\d+),(?P<col>\d+)\):\s*error\s+TS\d+:\s*(?P<msg>.+?)\s*$"
)


@dataclasses.dataclass(frozen=True)
class UnusedDiagnostic:
    file_path: pathlib.Path
    line: int
    col: int
    message: str
    symbol: Optional[str]


@dataclasses.dataclass
class EditAction:
    file_path: pathlib.Path
    line: int
    kind: str
    detail: str


def strip_ansi(text: str) -> str:
    return ANSI_RE.sub("", text)


def parse_symbol(message: str) -> Optional[str]:
    match = UNUSED_VALUE_RE.search(message)
    if match:
        return match.group(1)
    return None


def parse_diagnostics(text: str, base_dir: pathlib.Path) -> List[UnusedDiagnostic]:
    diagnostics: List[UnusedDiagnostic] = []

    for raw_line in text.splitlines():
        line = strip_ansi(raw_line).strip()
        if not line:
            continue

        match = TS_ERROR_LINE_RE.match(line) or TS_NATIVE_LINE_RE.match(line)
        if not match:
            continue

        message = match.group("msg")
        is_unused = (
            "is declared but its value is never read" in message
            or "All imports in import declaration are unused" in message
        )
        if not is_unused:
            continue

        file_part = match.group("file").strip()
        file_path = pathlib.Path(file_part)
        if not file_path.is_absolute():
            file_path = (base_dir / file_path).resolve()

        try:
            line_no = int(match.group("line"))
            col_no = int(match.group("col"))
        except ValueError:
            continue

        diagnostics.append(
            UnusedDiagnostic(
                file_path=file_path,
                line=line_no,
                col=col_no,
                message=message,
                symbol=parse_symbol(message),
            )
        )

    return diagnostics


def run_command(command: str, cwd: pathlib.Path) -> Tuple[int, str]:
    completed = subprocess.run(
        command,
        shell=True,
        cwd=str(cwd),
        text=True,
        stdout=subprocess.PIPE,
        stderr=subprocess.STDOUT,
        encoding="utf-8",
        errors="replace",
    )
    return completed.returncode, completed.stdout


def is_supported_source(path: pathlib.Path) -> bool:
    return path.suffix.lower() in {".ts", ".tsx", ".js", ".jsx"}


def comment_line(lines: List[str], index: int) -> bool:
    if index < 0 or index >= len(lines):
        return False
    stripped = lines[index].lstrip()
    if not stripped or stripped.startswith("//"):
        return False
    lines[index] = f"// UNUSED-AUTO: {lines[index]}"
    return True


def comment_import_block(lines: List[str], start_index: int) -> bool:
    if start_index < 0 or start_index >= len(lines):
        return False
    if "import" not in lines[start_index]:
        return False

    changed = False
    idx = start_index
    max_index = len(lines) - 1
    while idx <= max_index:
        stripped = lines[idx].lstrip()
        if stripped and not stripped.startswith("//"):
            lines[idx] = f"// UNUSED-AUTO: {lines[idx]}"
            changed = True
        if ";" in lines[idx]:
            break
        idx += 1
    return changed


def add_ignore_before_line(lines: List[str], index: int, symbol: str) -> bool:
    if index < 0 or index > len(lines):
        return False
    comment = f"// @ts-ignore UNUSED-AUTO: suppress unused '{symbol}'"
    if index > 0 and lines[index - 1].strip() == comment:
        return False
    lines.insert(index, comment)
    return True


def apply_file_fixes(file_path: pathlib.Path, file_diags: Iterable[UnusedDiagnostic]) -> Tuple[List[EditAction], Optional[str]]:
    if not file_path.exists() or not is_supported_source(file_path):
        return [], f"skip {file_path}: missing or unsupported extension"

    text = file_path.read_text(encoding="utf-8", errors="replace")
    lines = text.splitlines()
    actions: List[EditAction] = []

    sorted_diags = sorted(file_diags, key=lambda d: (d.line, d.col), reverse=True)
    changed = False

    for diag in sorted_diags:
        line_index = diag.line - 1
        symbol = diag.symbol or "unknown"

        if line_index < 0 or line_index >= len(lines):
            actions.append(
                EditAction(
                    file_path=file_path,
                    line=diag.line,
                    kind="skip",
                    detail=f"line out of range ({symbol})",
                )
            )
            continue

        line_text = lines[line_index]
        stripped = line_text.lstrip()

        did_change = False
        if stripped.startswith("import "):
            did_change = comment_import_block(lines, line_index)
            if did_change:
                actions.append(EditAction(file_path, diag.line, "comment-import", symbol))
        elif diag.symbol and re.search(rf"\b(const|let|var)\s+{re.escape(diag.symbol)}\b", line_text):
            did_change = comment_line(lines, line_index)
            if did_change:
                actions.append(EditAction(file_path, diag.line, "comment-var", symbol))
        elif "All imports in import declaration are unused" in diag.message:
            did_change = comment_import_block(lines, line_index)
            if did_change:
                actions.append(EditAction(file_path, diag.line, "comment-import", symbol))
        else:
            did_change = add_ignore_before_line(lines, line_index, symbol)
            if did_change:
                actions.append(EditAction(file_path, diag.line, "ts-ignore", symbol))

        if not did_change:
            actions.append(EditAction(file_path, diag.line, "skip", f"could not patch ({symbol})"))
        changed = changed or did_change

    if changed:
        new_text = "\n".join(lines) + ("\n" if text.endswith("\n") else "")
        file_path.write_text(new_text, encoding="utf-8")

    return actions, None


def format_action(action: EditAction) -> str:
    return f"[{action.kind}] {action.file_path}:{action.line} -> {action.detail}"


def main() -> int:
    parser = argparse.ArgumentParser(description="Comment unused TS declarations/imports from compiler diagnostics.")
    parser.add_argument(
        "--project-dir",
        default=".",
        help="Directory where compile command runs (default: current directory).",
    )
    parser.add_argument(
        "--command",
        default="npm run compile-check-ts-native",
        help="Command used to collect diagnostics when --log-file is not provided.",
    )
    parser.add_argument(
        "--log-file",
        default="",
        help="Path to existing compile log. If set, --command is not executed.",
    )
    parser.add_argument(
        "--apply",
        action="store_true",
        help="Apply comments to files. Without this flag, prints planned actions only.",
    )
    args = parser.parse_args()

    project_dir = pathlib.Path(args.project_dir).resolve()
    if not project_dir.exists():
        print(f"error: project directory not found: {project_dir}", file=sys.stderr)
        return 2

    if args.log_file:
        log_path = pathlib.Path(args.log_file).resolve()
        if not log_path.exists():
            print(f"error: log file not found: {log_path}", file=sys.stderr)
            return 2
        output = log_path.read_text(encoding="utf-8", errors="replace")
        exit_code = 0
    else:
        print(f"Running: {args.command}")
        exit_code, output = run_command(args.command, project_dir)
        print(f"Command exit code: {exit_code}")

    diagnostics = parse_diagnostics(output, project_dir)
    if not diagnostics:
        print("No unused diagnostics found.")
        return 0

    by_file: Dict[pathlib.Path, List[UnusedDiagnostic]] = defaultdict(list)
    for diag in diagnostics:
        by_file[diag.file_path].append(diag)

    print(f"Found {len(diagnostics)} unused diagnostics in {len(by_file)} file(s).")

    all_actions: List[EditAction] = []
    warnings: List[str] = []

    if args.apply:
        for file_path, file_diags in by_file.items():
            actions, warning = apply_file_fixes(file_path, file_diags)
            all_actions.extend(actions)
            if warning:
                warnings.append(warning)
    else:
        for file_path, file_diags in by_file.items():
            for diag in sorted(file_diags, key=lambda d: (d.line, d.col)):
                symbol = diag.symbol or "unknown"
                all_actions.append(EditAction(file_path, diag.line, "plan", symbol))

    for action in all_actions:
        print(format_action(action))

    for warning in warnings:
        print(f"warning: {warning}")

    applied = len([a for a in all_actions if a.kind not in {"plan", "skip"}])
    skipped = len([a for a in all_actions if a.kind == "skip"])
    print(f"Summary: total={len(all_actions)} applied_or_planned={len(all_actions)-skipped} skipped={skipped}")

    if not args.apply:
        print("Dry-run only. Re-run with --apply to modify files.")

    return 0


if __name__ == "__main__":
    raise SystemExit(main())


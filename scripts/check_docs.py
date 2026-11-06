#!/usr/bin/env python3
"""Check a repo's Markdown docs: structure, local links and anchors, the CLAUDE.md import,
required sections, banned terms and the docs index. No dependencies, no network.

Usage: python3 scripts/check_docs.py [repo_root]
Optional config: docs/.docscheck.json
  {
    "index": "docs/README.md",                       # every doc under docs/ must be linked from here
    "required_sections": {"docs/product.md": ["Requirements"], "docs/providers/*.md": ["Sources"]},
    "banned_terms": {"needs_reconnect": "use reconnect_required"},
    "banned_terms_skip": ["docs/glossary.md"],     # default; the glossary lists the words to avoid
    "skip": ["docs/archive/**"]
  }
Exit code 1 when anything fails, so it can sit inside the repo's one check command.
"""
from fnmatch import fnmatch
from pathlib import Path
from urllib.parse import unquote, urlsplit
import json
import re
import sys

ROOT = Path(sys.argv[1] if len(sys.argv) > 1 else ".").resolve()
CONFIG_PATH = ROOT / "docs" / ".docscheck.json"
config = json.loads(CONFIG_PATH.read_text()) if CONFIG_PATH.is_file() else {}
skip = config.get("skip", [])
errors: list[str] = []
KNOWN_KEYS = {"index", "required_sections", "banned_terms", "banned_terms_skip", "skip"}
for key in config:
    if key not in KNOWN_KEYS:
        errors.append(f"docs/.docscheck.json: unknown key '{key}' (known: {', '.join(sorted(KNOWN_KEYS))})")
# The glossary lists the words to avoid, so it is exempt from the banned-terms check unless configured otherwise.
banned_skip = config.get("banned_terms_skip", ["docs/glossary.md"])


def rel(path: Path) -> str:
    return path.relative_to(ROOT).as_posix()


def prose(text: str) -> str:
    """Text outside fenced code blocks and inline code."""
    text = re.sub(r"```.*?```", "", text, flags=re.S)
    return re.sub(r"`[^`\n]*`", "", text)


def slug(heading: str) -> str:
    heading = re.sub(r"[`*_]", "", heading.strip().lower())
    return re.sub(r"[^\w\- ]", "", heading).replace(" ", "-")


def anchors(text: str) -> set[str]:
    seen: dict[str, int] = {}
    result = set()
    for heading in re.findall(r"^#{1,6} (.+)$", prose(text), re.M):
        s = slug(heading)
        n = seen.get(s, 0)
        seen[s] = n + 1
        result.add(s if n == 0 else f"{s}-{n}")
    return result


docs = sorted(ROOT.glob("*.md")) + sorted((ROOT / "docs").rglob("*.md")) if (ROOT / "docs").is_dir() else sorted(ROOT.glob("*.md"))
docs = [d for d in docs if not any(fnmatch(rel(d), pattern) for pattern in skip)]

for path in docs:
    text = path.read_text(encoding="utf-8")
    label = rel(path)
    if path.name == "CLAUDE.md" and path.parent == ROOT:
        if (ROOT / "AGENTS.md").is_file() and text.strip() != "@AGENTS.md":
            errors.append(f"{label}: should contain exactly '@AGENTS.md' so every agent reads one rulebook")
        continue
    if text.count("```") % 2:
        errors.append(f"{label}: unclosed code fence")
    if len(re.findall(r"^# ", prose(text), re.M)) != 1:
        errors.append(f"{label}: expected exactly one H1")
    for number, line in enumerate(text.splitlines(), 1):
        if line != line.rstrip():
            errors.append(f"{label}:{number}: trailing whitespace")
    for raw in re.findall(r"!?\[[^\]]*\]\(([^)\s]+)(?:\s+\"[^\"]*\")?\)", prose(text)):
        target = raw.strip("<>")
        parts = urlsplit(target)
        if parts.scheme or parts.netloc or target.startswith("mailto:"):
            continue
        dest = (path.parent / unquote(parts.path)).resolve() if parts.path else path
        if not dest.is_relative_to(ROOT):
            errors.append(f"{label}: link leaves the repository: {target}")
        elif not dest.exists():
            errors.append(f"{label}: missing link target: {target}")
        elif parts.fragment and dest.suffix == ".md" and unquote(parts.fragment) not in anchors(dest.read_text(encoding="utf-8")):
            errors.append(f"{label}: missing anchor: {target}")
    for term, hint in ({} if any(fnmatch(label, p) for p in banned_skip) else config.get("banned_terms", {})).items():
        if re.search(rf"\b{re.escape(term)}\b", prose(text)):
            errors.append(f"{label}: banned term '{term}' ({hint})")

for pattern, sections in config.get("required_sections", {}).items():
    matches = [d for d in docs if fnmatch(rel(d), pattern)]
    if not matches and not any(ch in pattern for ch in "*?["):
        errors.append(f"{pattern}: required document is missing")
    for path in matches:
        headings = {h.strip() for h in re.findall(r"^#{2,6} (.+)$", prose(path.read_text(encoding="utf-8")), re.M)}
        for section in sections:
            if section not in headings:
                errors.append(f"{rel(path)}: missing section '{section}'")

index = config.get("index")
if index:
    index_path = ROOT / index
    if not index_path.is_file():
        errors.append(f"{index}: index document is missing")
    else:
        linked = {
            (index_path.parent / unquote(urlsplit(t).path)).resolve()
            for t in re.findall(r"\]\(([^)\s#]+)", prose(index_path.read_text(encoding="utf-8")))
            if not urlsplit(t).scheme
        }
        for path in docs:
            if path.is_relative_to(ROOT / "docs") and path != index_path and path.resolve() not in linked:
                errors.append(f"{rel(path)}: not linked from {index}")

if errors:
    print("\n".join(errors), file=sys.stderr)
    print(f"\ndocs check failed: {len(errors)} problem(s) in {len(docs)} file(s)", file=sys.stderr)
    sys.exit(1)
print(f"docs check passed: {len(docs)} file(s)")

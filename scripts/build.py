#!/usr/bin/env python3
"""Assemble the public site in dist/ from an allowlist of files, and write the
security headers Cloudflare Pages serves with it.

Only what is listed here goes public. Source material (the Blender file, the
export script, this script, the workflow) stays in the repository.

The Content-Security-Policy is generated from the pages themselves: every
inline <script> and <style> block is hashed, so the policy allows exactly the
inline code that is in the repository and nothing else. Edit a page and the
hashes follow on the next deploy; no hand maintenance.

Run from the repository root:  python3 scripts/build.py
"""
import base64
import hashlib
import re
import shutil
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
DIST = ROOT / "dist"

# Files and directories that make up the site. Directories are copied whole
# unless a glob narrows them.
PUBLIC = [
    "index.html",
    "case-ai.html",
    "case-poker.html",
    "case-system.html",
    "case.css",
    "css",
    "fonts",
    "img",
    "js",
    "models/*.glb",
]

# Third parties the stylesheets pull from. The five looks load their display
# fonts from Google Fonts; the Windows 95 look takes its UI font from jsDelivr.
STYLE_HOSTS = ["https://fonts.googleapis.com"]
FONT_HOSTS = ["https://fonts.gstatic.com", "https://cdn.jsdelivr.net"]

SCRIPT_RE = re.compile(r"<script(?P<attrs>[^>]*)>(?P<body>.*?)</script>", re.S | re.I)
STYLE_RE = re.compile(r"<style(?P<attrs>[^>]*)>(?P<body>.*?)</style>", re.S | re.I)


def sha256(text: str) -> str:
    digest = hashlib.sha256(text.encode("utf-8")).digest()
    return "'sha256-" + base64.b64encode(digest).decode("ascii") + "'"


def inline_hashes(html: str):
    scripts, styles = [], []
    for m in SCRIPT_RE.finditer(html):
        if re.search(r"\ssrc\s*=", m.group("attrs"), re.I):
            continue
        scripts.append(sha256(m.group("body")))
    for m in STYLE_RE.finditer(html):
        styles.append(sha256(m.group("body")))
    return scripts, styles


def copy_public():
    if DIST.exists():
        shutil.rmtree(DIST)
    DIST.mkdir()
    for entry in PUBLIC:
        matches = sorted(ROOT.glob(entry))
        if not matches:
            sys.exit(f"build: nothing matches {entry!r}")
        for src in matches:
            dst = DIST / src.relative_to(ROOT)
            if src.is_dir():
                shutil.copytree(src, dst, ignore=shutil.ignore_patterns(".DS_Store"))
            else:
                dst.parent.mkdir(parents=True, exist_ok=True)
                shutil.copy2(src, dst)


def csp() -> str:
    scripts, styles = [], []
    for page in sorted(DIST.glob("*.html")):
        s, t = inline_hashes(page.read_text(encoding="utf-8"))
        scripts += [h for h in s if h not in scripts]
        styles += [h for h in t if h not in styles]
    directives = [
        "default-src 'none'",
        "script-src 'self' " + " ".join(scripts),
        # style-src is the fallback for browsers without the -elem/-attr split
        "style-src 'self' 'unsafe-inline' " + " ".join(STYLE_HOSTS),
        "style-src-elem 'self' " + " ".join(styles + STYLE_HOSTS),
        "style-src-attr 'unsafe-inline'",  # the pages use style="" attributes
        "font-src 'self' " + " ".join(FONT_HOSTS),
        "img-src 'self' data: blob:",  # data: SVG patterns in CSS; blob: textures from the GLB models
        "connect-src 'self'",
        "manifest-src 'self'",
        "object-src 'none'",
        "base-uri 'none'",
        "form-action 'none'",
        "frame-ancestors 'none'",
        "upgrade-insecure-requests",
    ]
    return "; ".join(d.strip() for d in directives)


def write_headers():
    lines = [
        "/*",
        "  Content-Security-Policy: " + csp(),
        "  Strict-Transport-Security: max-age=31536000",
        "  X-Content-Type-Options: nosniff",
        "  X-Frame-Options: DENY",
        "  Referrer-Policy: strict-origin-when-cross-origin",
        "  Permissions-Policy: camera=(), microphone=(), geolocation=(), payment=(), usb=(), interest-cohort=()",
        "  Cross-Origin-Opener-Policy: same-origin",
        "  Cross-Origin-Resource-Policy: same-origin",
        "",
        "/fonts/*",
        "  Cache-Control: public, max-age=604800",
        "",
        "/models/*",
        "  Cache-Control: public, max-age=604800",
        "",
    ]
    (DIST / "_headers").write_text("\n".join(lines), encoding="utf-8")


def main():
    copy_public()
    write_headers()
    files = sorted(p.relative_to(DIST).as_posix() for p in DIST.rglob("*") if p.is_file())
    total = sum((DIST / f).stat().st_size for f in files)
    print(f"build: {len(files)} files, {total / 1e6:.1f} MB -> {DIST.relative_to(ROOT)}/")
    for f in files:
        print("  " + f)


if __name__ == "__main__":
    main()



from __future__ import annotations

import re
from pathlib import Path

from fontTools.subset import Options, Subsetter
from fontTools.ttLib import TTFont


ROOT = Path(__file__).resolve().parents[1]
SOURCE_DIR = ROOT / "src"
PRIMEICONS_DIR = ROOT / "node_modules" / "primeicons"
SOURCE_CSS = PRIMEICONS_DIR / "primeicons.css"
SOURCE_FONT = PRIMEICONS_DIR / "fonts" / "primeicons.ttf"
OUTPUT_CSS = SOURCE_DIR / "styles" / "primeicons-subset.css"
OUTPUT_FONT = ROOT / "public" / "assets" / "fonts" / "primeicons-subset.woff"

SOURCE_EXTENSIONS = {".html", ".ts", ".scss", ".css"}
ICON_REFERENCE = re.compile(r"\bpi-[a-z0-9-]+\b")
ICON_RULE = re.compile(
    r"\.([a-z0-9-]+):before\s*\{\s*content:\s*\"\\([0-9a-fA-F]+)\";\s*\}",
    re.MULTILINE,
)


def referenced_icons() -> set[str]:
    icons: set[str] = set()
    for path in SOURCE_DIR.rglob("*"):
        if path.is_file() and path.suffix in SOURCE_EXTENSIONS and path != OUTPUT_CSS:
            icons.update(ICON_REFERENCE.findall(path.read_text(encoding="utf-8")))
    return icons


def icon_mappings(css: str) -> dict[str, int]:
    return {name: int(codepoint, 16) for name, codepoint in ICON_RULE.findall(css)}


def write_css(selected: list[tuple[str, int]]) -> None:
    base = """/* Generado por scripts/generate-primeicons-subset.py. No editar manualmente. */
@font-face {
  font-family: 'primeicons';
  src: url('/assets/fonts/primeicons-subset.woff') format('woff');
  font-weight: normal;
  font-style: normal;
  font-display: swap;
}

.pi {
  font: normal normal normal 1em/1 'primeicons';
  display: inline-block;
  -webkit-font-smoothing: antialiased;
}

.pi-spin { animation: pi-spin 2s infinite linear; }

@media (prefers-reduced-motion: reduce) {
  .pi-spin {
    animation-duration: 1ms;
    animation-iteration-count: 1;
  }
}

@keyframes pi-spin {
  0% { transform: rotate(0deg); }
  100% { transform: rotate(359deg); }
}

"""
    rules = "\n".join(f'.{name}:before {{ content: "\\{codepoint:x}"; }}' for name, codepoint in selected)
    OUTPUT_CSS.parent.mkdir(parents=True, exist_ok=True)
    OUTPUT_CSS.write_text(base + rules + "\n", encoding="utf-8", newline="\n")


def write_font(codepoints: set[int]) -> None:
    font = TTFont(SOURCE_FONT)
    options = Options()
    options.flavor = "woff"
    subsetter = Subsetter(options=options)
    subsetter.populate(unicodes=codepoints)
    subsetter.subset(font)
    font.flavor = "woff"
    OUTPUT_FONT.parent.mkdir(parents=True, exist_ok=True)
    font.save(OUTPUT_FONT)


def main() -> None:
    css = SOURCE_CSS.read_text(encoding="utf-8")
    mappings = icon_mappings(css)
    requested = referenced_icons()
    selected = sorted(
        ((name, mappings[name]) for name in requested if name in mappings),
        key=lambda item: item[0],
    )
    if not selected:
        raise RuntimeError("No se encontraron iconos PrimeIcons utilizados por la aplicación")

    write_css(selected)
    write_font({codepoint for _, codepoint in selected})
    print(f"PrimeIcons: {len(selected)} de {len(mappings)} iconos incluidos")
    print(f"CSS: {OUTPUT_CSS.relative_to(ROOT)} ({OUTPUT_CSS.stat().st_size} bytes)")
    print(f"Fuente: {OUTPUT_FONT.relative_to(ROOT)} ({OUTPUT_FONT.stat().st_size} bytes)")


if __name__ == "__main__":
    main()

"""
Builds artworks.js (and small thumbnails) from the pictures in images/.

Name your files like:   2025-03-14_midnight-bloom.jpg      (date_title)
   date can be 2025, 2025-03 or 2025-03-14
Put pieces in sub-folders to set the medium:
   images/Acrylic/2025-03-14_tomato-sky.jpg   ->  medium "Acrylic"
   (files directly inside images/ get the medium "Art")

Run from this folder:   py make_artworks.py      (Windows)
Optional but recommended:   py -m pip install pillow   (makes thumbnails + exact image shapes)

Dates are found in this order: descriptions.json, the file name (2025-03-14_title,
or phone-style IMG_20240915), then the photo's own "date taken" if it has one.

Write titles/descriptions/dates/kind/subject in descriptions.json (created on first run); they are
kept every time you run this again.
   "kind":    "OC" or "Fanart" (shows a stamp, adds the type filter)
   "subject": who it is, e.g. a character name or "Character (Series)"
"""
import json, re
from pathlib import Path
from urllib.parse import quote

try:
    from PIL import Image
except ImportError:
    Image = None
    print("Pillow not installed: skipping thumbnails (pip install pillow to enable).")

ROOT = Path(__file__).parent
IMG = ROOT / "images"
THUMBS = ROOT / "thumbs"
THUMB_SIZE = (640, 640)
THUMB_QUALITY = 78
EXT = {".jpg", ".jpeg", ".png", ".webp", ".gif"}
notes_path = ROOT / "descriptions.json"
notes = json.loads(notes_path.read_text("utf-8")) if notes_path.exists() else {}
pat = re.compile(r"^(\d{4}(?:-\d{2}(?:-\d{2})?)?)[_ ](.+)$")
loose = re.compile(r"(?<!\d)((?:19|20)\d{2})[-_.]?(0[1-9]|1[0-2])[-_.]?(0[1-9]|[12]\d|3[01])(?!\d)")  # IMG_20240915, 2024-09-15, ...


def exif_date(im):
    """Date the photo was taken, if the file has one."""
    try:
        ex = im.getexif()
        raw = ex.get_ifd(0x8769).get(36867) or ex.get(306)   # DateTimeOriginal, then DateTime
        if raw and raw[:4].isdigit() and not raw.startswith("0000"):
            return raw[:10].replace(":", "-")
    except Exception:
        pass
    return ""

items = []
used_thumbs = set()
seen_keys = set()
for p in sorted(IMG.rglob("*")):
    if p.suffix.lower() not in EXT:
        continue
    key = p.relative_to(IMG).as_posix()
    m = pat.match(p.stem)
    date, name = (m.group(1), m.group(2)) if m else ("", p.stem)
    if not date:
        lm = loose.search(p.stem)
        if lm:
            date = "-".join(lm.groups())
    medium = p.parent.name if p.parent != IMG else "Art"
    seen_keys.add(key)
    n = notes.setdefault(key, {"title": "", "date": "", "medium": "", "description": ""})
    for extra in ("kind", "subject"):      # added to every entry, so you can fill them in
        n.setdefault(extra, "")

    ratio, thumb = "4/5", None
    if Image:
        with Image.open(p) as im:
            ratio = f"{im.size[0]}/{im.size[1]}"
            if not date and not n.get("date"):
                date = exif_date(im)
            t = THUMBS / (key + ".webp")   # keeps the original extension, so a.jpg and a.png never collide
            if not t.exists() or t.stat().st_mtime < max(p.stat().st_mtime, Path(__file__).stat().st_mtime):
                t.parent.mkdir(parents=True, exist_ok=True)
                im2 = im if im.mode in ("RGB", "RGBA") else im.convert("RGBA")
                im2.thumbnail(THUMB_SIZE)
                im2.save(t, "WEBP", quality=THUMB_QUALITY)
            used_thumbs.add(t.resolve())
            thumb = quote(t.relative_to(ROOT).as_posix())

    item = {
        "title": n.get("title") or re.sub(r"[-_]+", " ", name).strip().title(),
        "date": n.get("date") or date,
        "medium": n.get("medium") or medium,
        "description": n.get("description", ""),
        "kind": n.get("kind", ""),
        "subject": n.get("subject", ""),
        "image": quote(p.relative_to(ROOT).as_posix()),
        "ratio": ratio,
        "colors": n.get("colors", ["#ff5fa2", "#2f5bff"]),
    }
    if thumb:
        item["thumb"] = thumb
    items.append(item)

# ---- tidy up after renamed / deleted images ----
if Image and THUMBS.exists():
    removed = 0
    for f in THUMBS.rglob("*"):
        if f.is_file() and f.resolve() not in used_thumbs:
            f.unlink(); removed += 1
    for d in sorted((x for x in THUMBS.rglob("*") if x.is_dir()), reverse=True):
        if not any(d.iterdir()):
            d.rmdir()
    if removed:
        print(f"Removed {removed} thumbnails whose images no longer exist.")

stale = [k for k in notes if k not in seen_keys]
for k in stale:
    if not any(notes[k].values()):      # nothing written there, safe to drop
        del notes[k]
kept = [k for k in stale if k in notes]
if kept:
    print("\nThese descriptions.json entries match no image (renamed?). Copy their text to the new names:")
    for k in kept:
        print("  -", k)

untyped = [i["title"] for i in items if not i["kind"]]
if untyped:
    print(f"\n{len(untyped)} pieces have no type yet (set \"kind\": \"OC\" or \"Fanart\" in descriptions.json):")
    for t in untyped[:12]:
        print("  -", t)
    if len(untyped) > 12:
        print(f"  ... and {len(untyped) - 12} more")

(ROOT / "artworks.js").write_text(
    "const artworks = " + json.dumps(items, indent=2, ensure_ascii=False) + ";\n", "utf-8")
notes_path.write_text(json.dumps(notes, indent=2, ensure_ascii=False), "utf-8")
print(f"Done: {len(items)} pieces written to artworks.js")

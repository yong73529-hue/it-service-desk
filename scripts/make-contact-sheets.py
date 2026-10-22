from pathlib import Path
from PIL import Image, ImageDraw

root = Path(r"D:\project10\artifacts\user-guide\word-render2")
pages = sorted(root.glob("page-*.png"))
for sheet_index in range(0, len(pages), 6):
    batch = pages[sheet_index:sheet_index + 6]
    thumbs = []
    for page in batch:
        im = Image.open(page).convert("RGB")
        im.thumbnail((500, 707))
        thumbs.append((page.name, im.copy()))
    canvas = Image.new("RGB", (1020, 3 * 747), "#d9dde0")
    draw = ImageDraw.Draw(canvas)
    for i, (name, im) in enumerate(thumbs):
        x = (i % 2) * 510 + 5
        y = (i // 2) * 747 + 30
        draw.text((x + 5, 7 + (i // 2) * 747), name, fill="black")
        canvas.paste(im, (x, y))
    canvas.save(root / f"contact-{sheet_index // 6 + 1}.png")

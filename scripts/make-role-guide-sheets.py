from pathlib import Path
from PIL import Image, ImageDraw

base=Path(r"D:\project10\artifacts\role-guides")
for role in ("employee","ops","admin"):
    root=base/f"render-{role}"
    pages=sorted(root.glob("page-*.png"))
    for start in range(0,len(pages),4):
        batch=pages[start:start+4]
        canvas=Image.new("RGB",(1020,1494),"#d9dde0"); draw=ImageDraw.Draw(canvas)
        for i,page in enumerate(batch):
            im=Image.open(page).convert("RGB"); im.thumbnail((490,700))
            x=(i%2)*510+10; y=(i//2)*747+32
            draw.text((x,y-23),page.name,fill="black"); canvas.paste(im,(x,y))
        canvas.save(root/f"contact-{start//4+1}.png")

from pathlib import Path

import pypdfium2 as pdfium
from PIL import Image, ImageDraw


archive = Path(r"D:\Downloads\archive_09-Aug-2026_01_30_40.851277_6767365_mypeopledoc")
output = Path(r"D:\Downloads\planning-solo\tmp\pdfs")
files = sorted(archive.glob("bulletin-de-salaire-*.pdf"))

for page_index in (0, 1):
    thumbs = []
    for path in files:
        pdf = pdfium.PdfDocument(path)
        if page_index < len(pdf):
            image = pdf[page_index].render(scale=0.55).to_pil().convert("RGB")
        else:
            image = Image.new("RGB", (328, 464), "white")
            ImageDraw.Draw(image).text((95, 220), "Pas de page 2", fill="#777777")
        label = path.stem[-10:-3]
        canvas = Image.new("RGB", (image.width, image.height + 22), "white")
        canvas.paste(image, (0, 22))
        ImageDraw.Draw(canvas).text((5, 4), label, fill="black")
        thumbs.append(canvas)
        pdf.close()

    columns = 5
    rows = (len(thumbs) + columns - 1) // columns
    width = max(item.width for item in thumbs)
    height = max(item.height for item in thumbs)
    sheet = Image.new("RGB", (columns * width, rows * height), "#d8d8d8")
    for index, item in enumerate(thumbs):
        sheet.paste(item, ((index % columns) * width, (index // columns) * height))
    sheet.save(output / f"bulletins-contact-page-{page_index + 1}.jpg", quality=88)

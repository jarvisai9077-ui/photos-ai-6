# Renders the RF Photos logo (stacked photo cards + RF monogram + play mark) into all app icon assets.
import glob
from PIL import Image, ImageDraw, ImageFont, ImageFilter

S = 4096  # supersampled canvas
OUT = "/app/frontend/assets/images/"
ORANGE_A = (255, 122, 26)
ORANGE_B = (255, 77, 0)
WHITE = (255, 255, 255, 255)


def font(size):
    for p in glob.glob("/usr/share/fonts/**/*.ttf", recursive=True):
        if "DejaVuSans-Bold.ttf" in p or "LiberationSans-Bold.ttf" in p:
            return ImageFont.truetype(p, size)
    return ImageFont.load_default()


def gradient(size):
    g = Image.new("RGBA", (size, size))
    px = g.load()
    for y in range(size):
        for x in range(size):
            t = (x + y) / (2 * size)
            px[x, y] = tuple(int(ORANGE_A[i] + (ORANGE_B[i] - ORANGE_A[i]) * t) for i in range(3)) + (255,)
    return g


def mark(size, card_fill=WHITE, letter=(255, 94, 0, 255)):
    """Transparent layer with the white mark centered, occupying ~60% of the canvas."""
    m = Image.new("RGBA", (size, size), (0, 0, 0, 0))
    c = size / 2
    w, h = size * 0.46, size * 0.52
    r = size * 0.07
    stroke = int(size * 0.028)
    # back card (outline, rotated)
    back = Image.new("RGBA", (size, size), (0, 0, 0, 0))
    ImageDraw.Draw(back).rounded_rectangle([c - w / 2, c - h / 2, c + w / 2, c + h / 2], radius=r, outline=(255, 255, 255, 200), width=stroke)
    back = back.rotate(12, resample=Image.BICUBIC, center=(c + size * 0.05, c - size * 0.03))
    m.alpha_composite(back)
    # front card (filled)
    front = Image.new("RGBA", (size, size), (0, 0, 0, 0))
    fd = ImageDraw.Draw(front)
    box = [c - w / 2 - size * 0.04, c - h / 2 + size * 0.03, c + w / 2 - size * 0.04, c + h / 2 + size * 0.03]
    fd.rounded_rectangle(box, radius=r, fill=card_fill)
    # RF monogram
    f = font(int(size * 0.26))
    tw = fd.textbbox((0, 0), "RF", font=f)
    tx = (box[0] + box[2]) / 2 - (tw[2] - tw[0]) / 2 - tw[0]
    ty = (box[1] + box[3]) / 2 - (tw[3] - tw[1]) / 2 - tw[1] - size * 0.03
    fd.text((tx, ty), "RF", font=f, fill=letter)
    # play triangle (video) bottom-right of the front card
    px, py, ps = box[2] - size * 0.1, box[3] - size * 0.085, size * 0.05
    fd.polygon([(px - ps * 0.6, py - ps * 0.75), (px - ps * 0.6, py + ps * 0.75), (px + ps * 0.75, py)], fill=letter)
    # sparkle (memories) top-left of the front card
    sx, sy, sr = box[0] + size * 0.085, box[1] + size * 0.085, size * 0.03
    fd.polygon([(sx, sy - sr), (sx + sr * 0.28, sy - sr * 0.28), (sx + sr, sy), (sx + sr * 0.28, sy + sr * 0.28), (sx, sy + sr), (sx - sr * 0.28, sy + sr * 0.28), (sx - sr, sy), (sx - sr * 0.28, sy - sr * 0.28)], fill=letter)
    m.alpha_composite(front)
    return m


def rounded_mask(size, radius):
    mk = Image.new("L", (size, size), 0)
    ImageDraw.Draw(mk).rounded_rectangle([0, 0, size - 1, size - 1], radius=radius, fill=255)
    return mk


base = 1024
bg = gradient(512).resize((S, S), Image.BICUBIC)
mk = mark(S)
full = bg.copy()
full.alpha_composite(mk)
icon = full.resize((base, base), Image.LANCZOS).convert("RGB")
icon.save(OUT + "icon.png")
icon.save(OUT + "app-image.png")

# Android adaptive foreground: transparent, mark scaled into the 66% safe zone.
fg = Image.new("RGBA", (S, S), (0, 0, 0, 0))
small = mk.resize((int(S * 0.78), int(S * 0.78)), Image.LANCZOS)
fg.alpha_composite(small, ((S - small.width) // 2, (S - small.height) // 2))
fg.resize((base, base), Image.LANCZOS).save(OUT + "adaptive-icon.png")

# Splash: rounded icon tile on transparent background (splash bg colour comes from app.json).
tile = full.resize((base, base), Image.LANCZOS)
tile.putalpha(rounded_mask(base, int(base * 0.22)))
tile.save(OUT + "splash-image.png")
tile.save(OUT + "logo.png")

# Favicon
tile.resize((96, 96), Image.LANCZOS).save(OUT + "favicon.png")
print("logo assets written")

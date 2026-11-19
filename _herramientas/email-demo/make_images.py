"""Dibuja las imágenes del email demo (marca ficticia ILVANE) como SVG y las exporta a PNG 2x con Chromium."""
import os, sys
from playwright.sync_api import sync_playwright

OUT = sys.argv[1]
os.makedirs(OUT, exist_ok=True)

FONT = "font-family:'Helvetica Neue',Arial,sans-serif"


def bottle(x, y, w, h, body, cap, label_k, accent, collar="#C9CBD3", pump=True, scale=1.0):
    """Botella con dosificador. (x,y) = esquina superior del cuerpo."""
    r = w * 0.16
    neck_w = w * 0.34
    nx = x + (w - neck_w) / 2
    parts = []
    if pump:
        parts.append(f'<rect x="{nx + neck_w*0.38}" y="{y - h*0.27}" width="{neck_w*0.24}" height="{h*0.16}" fill="{cap}"/>')
        parts.append(f'<rect x="{nx - neck_w*0.35}" y="{y - h*0.3}" width="{neck_w*0.95}" height="{h*0.045}" rx="{h*0.02}" fill="{cap}"/>')
        parts.append(f'<rect x="{nx}" y="{y - h*0.13}" width="{neck_w}" height="{h*0.13}" rx="{neck_w*0.12}" fill="url(#collar)"/>')
    parts.append(f'<rect x="{x}" y="{y}" width="{w}" height="{h}" rx="{r}" fill="{body}"/>')
    parts.append(f'<rect x="{x + w*0.08}" y="{y + h*0.05}" width="{w*0.12}" height="{h*0.86}" rx="{w*0.06}" fill="#ffffff" opacity=".35"/>')
    parts.append(f'<text x="{x + w/2}" y="{y + h*0.17}" text-anchor="middle" style="{FONT};font-size:{w*0.135}px;letter-spacing:{w*0.02}px;font-weight:500" fill="#2A2A33">ILVANE</text>')
    parts.append(f'<text x="{x + w/2}" y="{y + h*0.235}" text-anchor="middle" style="{FONT};font-size:{w*0.06}px;letter-spacing:{w*0.025}px" fill="#2A2A33">PARIS</text>')
    # monograma: una "I" con remates
    mx, my, mh = x + w/2, y + h*0.33, h*0.2
    parts.append(f'<rect x="{mx - w*0.035}" y="{my}" width="{w*0.07}" height="{mh}" fill="{accent}"/>')
    parts.append(f'<rect x="{mx - w*0.11}" y="{my}" width="{w*0.22}" height="{w*0.035}" fill="{accent}"/>')
    parts.append(f'<rect x="{mx - w*0.11}" y="{my + mh - w*0.035}" width="{w*0.22}" height="{w*0.035}" fill="{accent}"/>')
    parts.append(f'<text x="{x + w/2}" y="{y + h*0.64}" text-anchor="middle" style="{FONT};font-size:{w*0.065}px;letter-spacing:{w*0.02}px" fill="#2A2A33">{label_k}</text>')
    for i in range(3):
        parts.append(f'<rect x="{x + w*0.28}" y="{y + h*(0.69 + i*0.035)}" width="{w*0.44}" height="{h*0.008}" fill="#2A2A33" opacity=".25"/>')
    parts.append(f'<text x="{x + w/2}" y="{y + h*0.92}" text-anchor="middle" style="{FONT};font-size:{w*0.055}px" fill="#2A2A33" opacity=".6">500 ml</text>')
    return "\n".join(parts)


DEFS = '''<defs>
  <linearGradient id="collar" x1="0" x2="1"><stop offset="0" stop-color="#8E919C"/><stop offset=".45" stop-color="#F4F5F8"/><stop offset="1" stop-color="#9A9DA8"/></linearGradient>
  <linearGradient id="heroBg" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#F7F6FA"/><stop offset=".7" stop-color="#ECEAF2"/><stop offset="1" stop-color="#DCD9E4"/></linearGradient>
  <linearGradient id="pouch" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#E4DDF6"/><stop offset=".6" stop-color="#CFC4EE"/><stop offset="1" stop-color="#B9ABE3"/></linearGradient>
  <linearGradient id="lav" x1="0" x2="1"><stop offset="0" stop-color="#C9BDF0"/><stop offset=".5" stop-color="#DDD4F8"/><stop offset="1" stop-color="#B8AAE6"/></linearGradient>
  <linearGradient id="giftBg" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#2B2622"/><stop offset=".55" stop-color="#1B1816"/><stop offset="1" stop-color="#141211"/></linearGradient>
  <linearGradient id="glass" x1="0" x2="1"><stop offset="0" stop-color="#C98E52"/><stop offset=".5" stop-color="#F0C891"/><stop offset="1" stop-color="#B9773F"/></linearGradient>
  <radialGradient id="glow" cx=".5" cy=".5" r=".5"><stop offset="0" stop-color="#F4C27E" stop-opacity=".55"/><stop offset="1" stop-color="#F4C27E" stop-opacity="0"/></radialGradient>
  <filter id="soft" x="-20%" y="-20%" width="140%" height="140%"><feGaussianBlur stdDeviation="14"/></filter>
</defs>'''


def svg(w, h, body, bg=None):
    bgr = f'<rect width="{w}" height="{h}" fill="{bg}"/>' if bg else ""
    return f'<svg xmlns="http://www.w3.org/2000/svg" width="{w}" height="{h}" viewBox="0 0 {w} {h}">{DEFS}{bgr}{body}</svg>'


def hero():
    w, h = 600, 400
    b = [f'<rect width="{w}" height="{h}" fill="url(#heroBg)"/>']
    b.append(f'<ellipse cx="300" cy="372" rx="250" ry="18" fill="#000" opacity=".08" filter="url(#soft)"/>')
    # cable de recarga
    b.append('<path d="M60 80 C 20 160, 40 300, 150 330 S 300 360, 330 300" fill="none" stroke="#B4A6E0" stroke-width="7" stroke-linecap="round"/>')
    # bolsa de recarga
    b.append('<path d="M115 70 L 285 52 Q 300 50 302 66 L 318 330 Q 320 350 300 352 L 140 365 Q 118 366 116 346 L 98 92 Q 96 72 115 70 Z" fill="url(#pouch)"/>')
    b.append('<path d="M118 76 L 286 58" stroke="#fff" stroke-width="5" opacity=".55"/>')
    b.append('<path d="M128 95 L 140 340" stroke="#fff" stroke-width="10" opacity=".25" stroke-linecap="round"/>')
    b.append(f'<text x="210" y="140" text-anchor="middle" transform="rotate(-4 210 140)" style="{FONT};font-size:26px;letter-spacing:4px;font-weight:500" fill="#2A2A33">ILVANE</text>')
    b.append(f'<text x="210" y="160" text-anchor="middle" transform="rotate(-4 210 160)" style="{FONT};font-size:10px;letter-spacing:4px" fill="#2A2A33">PARIS · RECARGA</text>')
    b.append('<g transform="rotate(-4 210 230)"><rect x="203" y="185" width="14" height="80" fill="#8A7BD0"/><rect x="190" y="185" width="40" height="8" fill="#8A7BD0"/><rect x="190" y="257" width="40" height="8" fill="#8A7BD0"/></g>')
    # botella
    b.append(bottle(360, 110, 150, 255, "url(#lav)", "#9C8FD8", "BLOND LUMIÈRE", "#8A7BD0"))
    return svg(w, h, "\n".join(b))


PRODUCTS = [
    ("lumiere", "#DCD3F7", "#9C8FD8", "#8A7BD0", "BLOND LUMIÈRE"),
    ("vitale", "#F6F4F1", "#E0703A", "#E0703A", "VITALE"),
    ("rose", "#F6DCDD", "#D9898F", "#D46A73", "ROSE CALME"),
    ("force", "#F7F7F8", "#C9CBD3", "#D8433F", "FORCE"),
    ("nectar", "#F2D9C4", "#D6A57A", "#B98C6A", "NECTAR"),
    ("sauge", "#D3E9DC", "#8CBFA2", "#5E9C7A", "SAUGE PURE"),
]


def product(body, cap, accent, label):
    w, h = 160, 220
    return svg(w, h, bottle(42, 58, 76, 150, body, cap, label, accent))


def gift():
    w, h = 600, 300
    b = [f'<rect width="{w}" height="{h}" fill="url(#giftBg)"/>']
    b.append('<circle cx="150" cy="190" r="140" fill="url(#glow)"/>')
    b.append('<ellipse cx="150" cy="282" rx="120" ry="10" fill="#000" opacity=".5" filter="url(#soft)"/>')
    for i, (x2, y2) in enumerate([(98, 40), (122, 26), (150, 18), (176, 28), (204, 44)]):
        b.append(f'<line x1="{140 + i*5}" y1="170" x2="{x2}" y2="{y2}" stroke="#0E0D0C" stroke-width="4" stroke-linecap="round"/>')
        b.append(f'<line x1="{140 + i*5}" y1="170" x2="{x2}" y2="{y2}" stroke="#5A524B" stroke-width="1.2" stroke-linecap="round" opacity=".7"/>')
    b.append('<rect x="132" y="150" width="36" height="26" rx="4" fill="#1A1817"/>')
    b.append('<path d="M110 176 H190 Q200 176 200 186 V268 Q200 280 188 280 H112 Q100 280 100 268 V186 Q100 176 110 176Z" fill="url(#glass)"/>')
    for i in range(9):
        b.append(f'<rect x="{106 + i*10}" y="182" width="2" height="94" fill="#fff" opacity=".18"/>')
    b.append(f'<rect x="114" y="212" width="72" height="38" fill="#F6EFE6"/>')
    b.append(f'<text x="150" y="230" text-anchor="middle" style="{FONT};font-size:9px;letter-spacing:2px;font-weight:600" fill="#2A2A33">ILVANE</text>')
    b.append(f'<text x="150" y="242" text-anchor="middle" style="{FONT};font-size:6px;letter-spacing:1.5px" fill="#2A2A33">AROMA HOGAR</text>')
    return svg(w, h, "\n".join(b))


ICONS = {
    "pago": '<rect x="10" y="16" width="28" height="18" rx="3" fill="none" stroke="#1B1B22" stroke-width="2.2"/><path d="M10 22h28" stroke="#1B1B22" stroke-width="2.2"/><circle cx="35" cy="33" r="6" fill="#1B1B22"/><path d="M32.5 33l1.8 1.8 3.2-3.4" fill="none" stroke="#fff" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/>',
    "muestras": '<rect x="12" y="14" width="10" height="22" rx="2" fill="none" stroke="#1B1B22" stroke-width="2.2"/><rect x="26" y="14" width="10" height="22" rx="2" fill="none" stroke="#1B1B22" stroke-width="2.2"/><path d="M17 20v10M31 20v10" stroke="#1B1B22" stroke-width="2.2"/>',
    "envio": '<path d="M8 16h20v16H8z" fill="none" stroke="#1B1B22" stroke-width="2.2" stroke-linejoin="round"/><path d="M28 21h7l5 6v5H28z" fill="none" stroke="#1B1B22" stroke-width="2.2" stroke-linejoin="round"/><circle cx="15" cy="34" r="3.2" fill="#fff" stroke="#1B1B22" stroke-width="2.2"/><circle cx="34" cy="34" r="3.2" fill="#fff" stroke="#1B1B22" stroke-width="2.2"/>',
    "atencion": '<path d="M13 27v-4a11 11 0 0 1 22 0v4" fill="none" stroke="#1B1B22" stroke-width="2.2"/><rect x="10" y="25" width="6" height="10" rx="2" fill="#1B1B22"/><rect x="32" y="25" width="6" height="10" rx="2" fill="#1B1B22"/><path d="M35 35c0 3-3 5-8 5" fill="none" stroke="#1B1B22" stroke-width="2.2" stroke-linecap="round"/>',
}


def icon(path):
    return svg(48, 48, f'<circle cx="24" cy="24" r="24" fill="#F1EEF8"/>{path}')


def render(page, markup, w, h, name, transparent=False):
    html = f'<html><body style="margin:0;background:{"transparent" if transparent else "#fff"}">{markup}</body></html>'
    page.set_viewport_size({"width": w, "height": h})
    page.set_content(html)
    page.screenshot(path=os.path.join(OUT, name), omit_background=transparent,
                    clip={"x": 0, "y": 0, "width": w, "height": h})
    print("ok", name)


with sync_playwright() as p:
    b = p.chromium.launch()
    pg = b.new_page(device_scale_factor=2)
    render(pg, hero(), 600, 400, "hero.png")
    for slug, body, cap, accent, label in PRODUCTS:
        render(pg, product(body, cap, accent, label), 160, 220, f"producto-{slug}.png", transparent=True)
    render(pg, gift(), 600, 300, "regalo.png")
    for k, v in ICONS.items():
        render(pg, icon(v), 48, 48, f"icono-{k}.png", transparent=True)
    b.close()

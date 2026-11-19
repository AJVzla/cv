"""Arma el email final a partir de email.src.html. Uso: build_email.py <salida.html> <base_imagenes> <url_web>"""
import sys

out, img_base, web = sys.argv[1], sys.argv[2], sys.argv[3]
FONT = "Montserrat, Arial, Helvetica, sans-serif"

PRODUCTS = [
    ("lumiere", "Blond Lumière", "Shampoo violeta"),
    ("vitale", "Vitale", "Shampoo nutritivo"),
    ("rose", "Rose Calme", "Shampoo calmante"),
    ("force", "Force", "Shampoo fortificante"),
    ("nectar", "Nectar", "Shampoo brillo"),
    ("sauge", "Sauge Pure", "Shampoo purificante"),
]

BENEFITS = [
    ("pago", "Pago seguro"),
    ("muestras", "Muestras de regalo"),
    ("envio", "Envío gratis desde $50.000"),
    ("atencion", "Atención al cliente"),
]

MENU = ["Gamas", "Top 10", "Shampoos", "Máscaras y acondicionadores", "Aceites y sérums", "Styling"]


def product_cell(slug, name, kind):
    return f'''<td width="33%" align="center" valign="top" style="width:33.33%; padding:0 4px 22px;">
            <a href="#" style="text-decoration:none;">
              <img src="{img_base}producto-{slug}.png" width="140" alt="{name}, {kind.lower()} de 500 ml" style="display:block; margin:0 auto; width:100%; max-width:140px; height:auto; border:0; font-family:Arial, sans-serif; font-size:12px; color:#6B6B76;">
            </a>
            <p class="dm-text" style="margin:8px 0 0; font-family:{FONT}; font-size:13px; line-height:18px; font-weight:700; letter-spacing:.5px; color:#111111;">{name}</p>
            <p class="dm-muted" style="margin:2px 0 0; font-family:{FONT}; font-size:12px; line-height:17px; color:#6B6B76;">{kind}</p>
          </td>'''


rows = []
for i in range(0, len(PRODUCTS), 3):
    cells = "\n          ".join(product_cell(*p) for p in PRODUCTS[i:i + 3])
    rows.append(f"<tr>\n          {cells}\n        </tr>")

benefits = []
for slug, label in BENEFITS:
    benefits.append(f'''<!--[if mso]><td width="150" valign="top" style="width:150px;"><![endif]-->
      <div style="display:inline-block; width:100%; max-width:150px; vertical-align:top;">
        <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0">
          <tr><td align="center" style="padding:0 8px 18px;">
            <img src="{img_base}icono-{slug}.png" width="48" height="48" alt="" style="display:block; margin:0 auto; width:48px; height:48px; border:0;">
            <p class="dm-text" style="margin:8px 0 0; font-family:{FONT}; font-size:12px; line-height:17px; color:#111111;">{label}</p>
          </td></tr>
        </table>
      </div>
      <!--[if mso]></td><![endif]-->''')

menu = []
for item in MENU:
    menu.append(f'''<tr>
          <td align="center" class="dm-menu" style="border-top:1px solid #3A3A40; padding:13px 0;">
            <a href="#" class="menu-link" style="font-family:{FONT}; font-size:13px; line-height:18px; letter-spacing:2px; color:#FFFFFF; text-decoration:none; text-transform:uppercase;">{item}</a>
          </td>
        </tr>''')

html = open("email.src.html").read()
html = (html.replace("{{PRODUCT_ROWS}}", "\n        ".join(rows))
            .replace("{{BENEFITS}}", "\n      ".join(benefits))
            .replace("{{MENU}}", "\n        ".join(menu))
            .replace("{{IMG}}", img_base)
            .replace("{{WEB}}", web))
assert "{{" not in html
open(out, "w").write(html)
print("ok", out, len(html), "bytes")

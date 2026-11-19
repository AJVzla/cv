# Email de ejemplo (ILVANE, marca ficticia)

- `email.src.html`: plantilla del email. Los productos, beneficios y el menú se generan desde `build_email.py`.
- `make_images.py`: dibuja las ilustraciones (requiere Python y Playwright).

Para regenerar el email publicado, desde esta carpeta:

```bash
python3 build_email.py ../../maquetacion-emails-html/ejemplo/email.html \
  "https://anthonymasyrubi.com/maquetacion-emails-html/ejemplo/img/" \
  "https://anthonymasyrubi.com/maquetacion-emails-html/ejemplo/email.html"
```

Esta carpeta no se publica en el sitio (ver `_config.yml`).

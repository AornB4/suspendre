===============================================================
  SUSPENDRE — images/ folder
  All product images are served from this folder.
===============================================================

HOW IT WORKS
------------
Every image reference in the codebase points here using the
relative path:  ../images/filename.jpg

If a file is missing, the browser automatically shows
placeholder.svg (the hanger icon already in this folder).


WHERE TO SWAP IMAGES
--------------------
Open  JsFolder/data.js  and find the image field for each
product. Change the filename to match whatever file you drop
into this folder.

Example:
  image: '../images/walnut-prestige.jpg',   ← change this filename


REQUIRED FILENAMES (default)
-----------------------------
Drop your photos here with EXACTLY these names:

  walnut-prestige.jpg       — Walnut Prestige        (p001)
  aurum-gold-edition.jpg    — Aurum Gold Edition      (p002)
  midnight-velvet.jpg       — Midnight Velvet         (p003)
  chrome-architecte.jpg     — Chrome Architecte       (p004)
  mahogany-heirloom.jpg     — Mahogany Heirloom       (p005)
  ivory-velours.jpg         — Ivory Velours           (p006)
  titanium-reserve.jpg      — Titanium Reserve        (p007)
  rose-gold-atelier.jpg     — Rose Gold Atelier       (p008)
  ebony-noir.jpg            — Ebony Noir              (p009)
  champagne-velours.jpg     — Champagne Velours       (p010)
  placeholder.svg           — Fallback (already here) 


USING YOUR OWN FILENAMES
-------------------------
You are not locked into the names above. To use your own:

  1. Drop your image file here, e.g.  my-photo.jpg
  2. Open  JsFolder/data.js
  3. Find the product and update:
       image: '../images/my-photo.jpg',
  4. Save. Done.


SUPPORTED FORMATS
-----------------
  .jpg  .jpeg  .png  .webp

Recommended size: 600 × 600 px minimum (square crop looks best).
Keep files under 500 KB for fast loading.


WHERE IMAGES ARE USED IN THE CODE
-----------------------------------
  JsFolder/data.js       — source of truth (image field per product)
  JsFolder/app.js        — product cards on homepage & shop
  JsFolder/product.js    — product detail page image
  JsFolder/cart.js       — cart page product thumbnails
  JsFolder/admin.js      — admin panel product list thumbnails
  JsFolder/app.js        — cart drawer thumbnails

All fallbacks point to:  ../images/placeholder.svg


ADDING A NEW PRODUCT (via Admin panel)
----------------------------------------
When you add a product through the admin UI, enter the filename
only (e.g.  my-new-hanger.jpg ) in the Image field, then make
sure that file exists in this folder.

===============================================================

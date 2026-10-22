# Field & Furrow local parts shop

A small static storefront for browsing 1,524 parts with photos in 26 categories. Search shows the part photo. Part data is in `products.json` / `categories.json`; photos are in `parts/`. No supplier details or source-catalog links are shown on the site.

## Run locally

From this folder, start Python's built-in web server:

```sh
python3 -m http.server 8000
```

Then open <http://localhost:8000>. Stop the server with `Ctrl+C`.

Everything is served from this folder. No install or external font/image service is required. The source PDF is not linked from the site.

## Quote list

Add parts to the quote list. The list is saved in this browser's local storage. **Prepare quote email** opens an email draft addressed to the quote address (`QUOTE_EMAIL` at the top of `app.js`) with your list; it does not send automatically.

Part text comes from OCR of a scanned catalog and may contain recognition errors.

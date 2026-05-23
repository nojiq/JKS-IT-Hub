from __future__ import annotations

from datetime import datetime, timezone
from typing import Any
from urllib.parse import urlparse

from fastapi import FastAPI, HTTPException
from pydantic import BaseModel, HttpUrl

from scraper.marketplaces import detect_marketplace, parse_product_html

app = FastAPI(title="IT-Hub Marketplace Scraper")


class PreviewRequest(BaseModel):
    url: HttpUrl


def _fetch_html(url: str) -> str:
    from scrapling.fetchers import DynamicFetcher, Fetcher

    page = Fetcher.get(url, timeout=15, retries=1, follow_redirects="safe", impersonate="chrome")
    html = _response_html(page)
    preview = parse_product_html(url, html)
    if preview.get("name") and preview.get("variants"):
        return html

    dynamic_page = DynamicFetcher.fetch(
        url,
        timeout=15000,
        network_idle=True,
        disable_resources=True,
        headless=True,
    )
    return _response_html(dynamic_page)


def _response_html(page: Any) -> str:
    html_content = getattr(page, "html_content", None)
    if isinstance(html_content, str) and html_content:
        return html_content
    if html_content is not None:
        html_text = str(html_content)
        if html_text:
            return html_text

    body = getattr(page, "body", None)
    if isinstance(body, bytes):
        return body.decode("utf-8", errors="replace")

    text = getattr(page, "text", None)
    if callable(text):
        return text()
    if isinstance(text, str):
        return text
    return str(page)


@app.get("/health")
def health() -> dict[str, str]:
    return {"status": "ok"}


@app.post("/preview")
def preview(payload: PreviewRequest) -> dict[str, Any]:
    url = str(payload.url)
    marketplace = detect_marketplace(url)
    if marketplace is None:
        raise HTTPException(status_code=400, detail="Only Shopee Malaysia and Lazada Malaysia URLs are supported.")

    parsed = urlparse(url)
    if parsed.scheme not in {"http", "https"}:
        raise HTTPException(status_code=400, detail="Only HTTP and HTTPS URLs are supported.")

    try:
        html = _fetch_html(url)
        data = parse_product_html(url, html)
    except HTTPException:
        raise
    except Exception as exc:
        raise HTTPException(status_code=502, detail=f"Marketplace fetch failed: {exc}") from exc

    data["fetchedAt"] = datetime.now(timezone.utc).isoformat().replace("+00:00", "Z")
    return {"data": data}

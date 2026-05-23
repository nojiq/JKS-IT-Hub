from __future__ import annotations

import json
import re
from html import unescape
from typing import Any
from urllib.parse import urlparse

SUPPORTED_HOSTS = {
    "SHOPEE": ("shopee.com.my",),
    "LAZADA": ("lazada.com.my",),
}


def detect_marketplace(url: str) -> str | None:
    host = urlparse(url).hostname or ""
    host = host.lower()
    for marketplace, suffixes in SUPPORTED_HOSTS.items():
        if any(host == suffix or host.endswith(f".{suffix}") for suffix in suffixes):
            return marketplace
    return None


def parse_product_html(url: str, html: str) -> dict[str, Any]:
    marketplace = detect_marketplace(url)
    if marketplace is None:
        raise ValueError("unsupported marketplace")

    json_ld = _extract_json_ld_products(html)
    embedded = _extract_embedded_objects(html)
    meta = _extract_meta(html)

    product = _merge_product_sources(embedded, json_ld, meta)
    variants = _extract_variants(embedded)
    base_price = product.get("price")
    if not variants and base_price:
        variants = [{
            "label": "Default",
            "options": {},
            "price": base_price,
            "currency": product.get("currency") or "MYR",
            "imageUrl": product.get("imageUrl"),
            "available": True,
        }]

    warnings = []
    if not variants:
        warnings.append("No variants or base price found.")
    elif not any(variant.get("price") for variant in variants):
        warnings.append("Variant prices were not available from marketplace response.")
    has_priced_variant = any(variant.get("price") for variant in variants)

    return {
        "marketplace": marketplace,
        "name": product.get("name") or "",
        "vendorName": product.get("vendorName") or "",
        "imageUrl": product.get("imageUrl") or "",
        "categoryPath": product.get("categoryPath") or [],
        "currency": product.get("currency") or "MYR",
        "variants": variants,
        "sourceUrl": url,
        "fetchedAt": None,
        "confidence": "high" if product.get("name") and has_priced_variant else "partial",
        "warnings": warnings,
    }


def _extract_json_ld_products(html: str) -> list[dict[str, Any]]:
    products: list[dict[str, Any]] = []
    scripts = re.findall(
        r"<script[^>]+type=[\"']application/ld\+json[\"'][^>]*>(.*?)</script>",
        html,
        flags=re.IGNORECASE | re.DOTALL,
    )
    for raw in scripts:
        try:
            data = json.loads(unescape(raw.strip()))
        except json.JSONDecodeError:
            continue
        for item in _iter_json_items(data):
            item_type = item.get("@type")
            if item_type == "Product" or (isinstance(item_type, list) and "Product" in item_type):
                products.append(item)
    return products


def _extract_embedded_objects(html: str) -> list[dict[str, Any]]:
    objects: list[dict[str, Any]] = []
    patterns = [
        r"window\.__PRODUCT_STATE__\s*=\s*({.*?})\s*;",
        r"window\.__INITIAL_STATE__\s*=\s*({.*?})\s*;",
        r"<script[^>]+id=[\"']__NEXT_DATA__[\"'][^>]*>(.*?)</script>",
        r"<script[^>]+type=[\"']text/mfe-initial-data[\"'][^>]*>(.*?)</script>",
    ]
    for pattern in patterns:
        for raw in re.findall(pattern, html, flags=re.IGNORECASE | re.DOTALL):
            try:
                objects.append(json.loads(unescape(raw.strip())))
            except json.JSONDecodeError:
                continue
    module_data = _extract_json_assignment(html, "var __moduleData__ =")
    if module_data:
        objects.append(module_data)
    return objects


def _extract_json_assignment(html: str, marker: str) -> dict[str, Any] | None:
    marker_index = html.find(marker)
    if marker_index == -1:
        return None
    start = html.find("{", marker_index)
    if start == -1:
        return None

    depth = 0
    in_string = False
    escaped = False
    for index, char in enumerate(html[start:], start):
        if in_string:
            if escaped:
                escaped = False
            elif char == "\\":
                escaped = True
            elif char == '"':
                in_string = False
            continue

        if char == '"':
            in_string = True
        elif char == "{":
            depth += 1
        elif char == "}":
            depth -= 1
            if depth == 0:
                try:
                    return json.loads(unescape(html[start:index + 1]))
                except json.JSONDecodeError:
                    return None
    return None


def _extract_meta(html: str) -> dict[str, Any]:
    meta: dict[str, Any] = {}
    for attrs in re.findall(r"<meta\s+([^>]+)>", html, flags=re.IGNORECASE):
        key_match = re.search(r"(?:property|name)=[\"']([^\"']+)[\"']", attrs, flags=re.IGNORECASE)
        value_match = re.search(r"content=[\"']([^\"']*)[\"']", attrs, flags=re.IGNORECASE)
        if not key_match or not value_match:
            continue
        meta[key_match.group(1).lower()] = unescape(value_match.group(1))
    return {
        "name": meta.get("og:title") or meta.get("twitter:title"),
        "imageUrl": meta.get("og:image") or meta.get("twitter:image"),
        "vendorName": meta.get("og:site_name"),
        "price": _normalize_price(meta.get("product:price:amount")),
        "currency": meta.get("product:price:currency"),
    }


def _merge_product_sources(
    embedded_objects: list[dict[str, Any]],
    json_ld_products: list[dict[str, Any]],
    meta: dict[str, Any],
) -> dict[str, Any]:
    embedded = _first_embedded_product(embedded_objects) or {}
    json_ld = _map_json_ld_product(json_ld_products[0]) if json_ld_products else {}
    merged = {}
    for key in ["name", "vendorName", "imageUrl", "categoryPath", "price", "currency"]:
        merged[key] = embedded.get(key) or json_ld.get(key) or meta.get(key)
    return merged


def _first_embedded_product(objects: list[dict[str, Any]]) -> dict[str, Any] | None:
    shopee_product = _shopee_mfe_product(objects)
    if shopee_product:
        return shopee_product
    lazada_product = _lazada_module_product(objects)
    if lazada_product:
        return lazada_product

    for candidate in _walk_dicts(objects):
        name = _first_value(candidate, ["name", "title", "productName", "itemName"])
        if not name:
            continue
        price = _first_value(candidate, ["price", "salePrice", "price_min", "priceMin", "priceShow"])
        image = _first_value(candidate, ["image", "imageUrl", "mainImage", "image_url", "thumbUrl"])
        return {
            "name": str(name),
            "vendorName": _first_value(candidate, ["shopName", "sellerName", "storeName", "brandName"]) or "",
            "imageUrl": _first_image(image),
            "categoryPath": _category_path(candidate),
            "price": _normalize_price(price),
            "currency": _first_value(candidate, ["currency", "priceCurrency"]) or "MYR",
        }
    return None


def _lazada_module_product(objects: list[dict[str, Any]]) -> dict[str, Any] | None:
    for candidate in _walk_dicts(objects):
        fields = candidate.get("fields")
        if not isinstance(fields, dict):
            continue
        tracking = fields.get("tracking") if isinstance(fields.get("tracking"), dict) else {}
        product = fields.get("product") if isinstance(fields.get("product"), dict) else {}
        if not tracking and not product:
            continue
        name = product.get("title") or tracking.get("pdt_name")
        if not name:
            continue
        core = tracking.get("core") if isinstance(tracking.get("core"), dict) else {}
        return {
            "name": str(name),
            "vendorName": tracking.get("seller_name") or "",
            "imageUrl": _first_image(tracking.get("pdt_photo")),
            "categoryPath": tracking.get("pdt_category") or [],
            "price": _normalize_price(tracking.get("pdt_price")),
            "currency": core.get("currencyCode") or "MYR",
        }
    return None


def _shopee_mfe_product(objects: list[dict[str, Any]]) -> dict[str, Any] | None:
    for candidate in _walk_dicts(objects):
        cached_map = candidate.get("cachedMap")
        if not isinstance(cached_map, dict):
            continue
        for product in cached_map.values():
            if not isinstance(product, dict):
                continue
            item = product.get("item")
            if not isinstance(item, dict):
                continue
            name = _first_value(item, ["name", "title", "productName", "itemName"])
            if not name:
                continue
            shop = product.get("shop_detailed") if isinstance(product.get("shop_detailed"), dict) else {}
            price = _first_value(item, ["price", "price_min", "priceMin"])
            return {
                "name": str(name),
                "vendorName": _first_value(shop, ["name", "shopName", "sellerName"]) or "",
                "imageUrl": _first_image(_first_value(item, ["image", "imageUrl", "mainImage", "image_url", "thumbUrl"])),
                "categoryPath": _category_path(item),
                "price": _normalize_price(price),
                "currency": _first_value(item, ["currency", "priceCurrency"]) or "MYR",
            }
    return None


def _map_json_ld_product(product: dict[str, Any]) -> dict[str, Any]:
    offers = product.get("offers") or {}
    if isinstance(offers, list):
        offers = offers[0] if offers else {}
    seller = offers.get("seller") if isinstance(offers, dict) else {}
    return {
        "name": product.get("name"),
        "vendorName": seller.get("name") if isinstance(seller, dict) else "",
        "imageUrl": _first_image(product.get("image")),
        "categoryPath": _category_path(product),
        "price": _normalize_price(offers.get("price") if isinstance(offers, dict) else None),
        "currency": offers.get("priceCurrency") if isinstance(offers, dict) else None,
    }


def _extract_variants(objects: list[dict[str, Any]]) -> list[dict[str, Any]]:
    lazada_variants = _extract_lazada_variants(objects)
    if lazada_variants:
        return lazada_variants

    variants = []
    for candidate in _walk_dicts(objects):
        rows = candidate.get("models") or candidate.get("skus") or candidate.get("variants")
        if not isinstance(rows, list):
            continue
        tier_variations = candidate.get("tier_variations") if isinstance(candidate.get("tier_variations"), list) else []
        for row in rows:
            if not isinstance(row, dict):
                continue
            price = _normalize_price(_first_value(row, ["price", "salePrice", "priceShow", "price_min", "priceMin"]))
            label = _first_value(row, ["name", "label", "skuName", "modelName"])
            options = _options(row, tier_variations)
            if not price and not label and not options:
                continue
            variants.append({
                "label": str(label or "Default"),
                "options": options,
                "price": price,
                "currency": _first_value(row, ["currency", "priceCurrency"]) or "MYR",
                "imageUrl": _variant_image(row, tier_variations),
                "available": _available(row),
                "skuId": _string_or_none(_first_value(row, ["skuId", "skuid", "sku_id"])),
                "modelId": _string_or_none(_first_value(row, ["model_id", "modelid", "modelId", "id"])),
                "itemId": _string_or_none(_first_value(row, ["item_id", "itemid", "itemId"])),
                "promotionId": _string_or_none(_first_value(row, ["promotion_id", "promotionid", "promotionId"])),
            })
        if variants:
            return variants
    return variants


def _extract_lazada_variants(objects: list[dict[str, Any]]) -> list[dict[str, Any]]:
    for candidate in _walk_dicts(objects):
        fields = candidate.get("fields")
        if not isinstance(fields, dict):
            continue
        product_option = fields.get("productOption") if isinstance(fields.get("productOption"), dict) else {}
        sku_base = product_option.get("skuBase") if isinstance(product_option.get("skuBase"), dict) else {}
        skus = sku_base.get("skus")
        properties = sku_base.get("properties")
        if not isinstance(skus, list) or not isinstance(properties, list):
            continue

        tracking = fields.get("tracking") if isinstance(fields.get("tracking"), dict) else {}
        core = tracking.get("core") if isinstance(tracking.get("core"), dict) else {}
        sku_infos = fields.get("skuInfos") if isinstance(fields.get("skuInfos"), dict) else {}
        product = fields.get("product") if isinstance(fields.get("product"), dict) else {}
        option_lookup = _lazada_option_lookup(properties)
        base_price = _normalize_price(tracking.get("pdt_price"))
        currency = core.get("currencyCode") or "MYR"

        variants = []
        for sku in skus:
            if not isinstance(sku, dict):
                continue
            options = {}
            image = ""
            for part in str(sku.get("propPath") or "").split(";"):
                option = option_lookup.get(part)
                if not option:
                    continue
                options[option["name"]] = option["value"]
                image = image or option["image"]
            sku_info = sku_infos.get(str(sku.get("skuId"))) or {}
            image = _first_image(sku_info.get("image")) or image
            price = _lazada_sku_price(sku_info) or base_price
            label = " / ".join(options.values()) or "Default"
            variants.append({
                "label": label,
                "options": options,
                "price": price,
                "currency": currency,
                "imageUrl": image,
                "available": not bool((sku_info.get("operation") or {}).get("disable")),
                "skuId": _string_or_none(sku.get("skuId") or sku_info.get("skuId")),
                "itemId": _string_or_none(sku.get("itemId") or sku_info.get("itemId")),
                "sellerId": _string_or_none(sku.get("sellerId") or sku_info.get("sellerId")),
                "sourceVariantUrl": _lazada_variant_url(sku.get("pagePath") or product.get("link")),
            })
        if variants:
            return variants
    return []


def _lazada_option_lookup(properties: list[dict[str, Any]]) -> dict[str, dict[str, str]]:
    lookup = {}
    for prop in properties:
        prop_id = str(prop.get("pid") or "")
        prop_name = str(prop.get("name") or "Option")
        values = prop.get("values")
        if not prop_id or not isinstance(values, list):
            continue
        for value in values:
            if not isinstance(value, dict):
                continue
            value_id = str(value.get("vid") or "")
            value_name = str(value.get("name") or "")
            if value_id and value_name:
                lookup[f"{prop_id}:{value_id}"] = {
                    "name": prop_name,
                    "value": value_name,
                    "image": _first_image(value.get("image") or value.get("hoverImage")),
                }
    return lookup


def _lazada_sku_price(sku_info: dict[str, Any]) -> str:
    for key in ["price", "salePrice", "sale_price", "priceText", "price_text", "currentPrice", "current_price"]:
        price = _normalize_price(sku_info.get(key))
        if price:
            return price
    return ""


def _lazada_variant_url(value: Any) -> str:
    text = str(value or "")
    if not text:
        return ""
    if text.startswith("//"):
        return f"https:{text}"
    if text.startswith(("http://", "https://")):
        return text
    if text.startswith("/"):
        return f"https://www.lazada.com.my{text}"
    return ""


def _iter_json_items(data: Any):
    if isinstance(data, dict):
        if "@graph" in data:
            for item in _iter_json_items(data["@graph"]):
                yield item
        else:
            yield data
    elif isinstance(data, list):
        for item in data:
            yield from _iter_json_items(item)


def _walk_dicts(value: Any):
    if isinstance(value, dict):
        yield value
        for child in value.values():
            yield from _walk_dicts(child)
    elif isinstance(value, list):
        for child in value:
            yield from _walk_dicts(child)


def _first_value(data: dict[str, Any], keys: list[str]) -> Any:
    for key in keys:
        if key in data and data[key] not in (None, ""):
            return data[key]
    return None


def _string_or_none(value: Any) -> str | None:
    if value in (None, ""):
        return None
    return str(value)


def _first_image(value: Any) -> str:
    if isinstance(value, list):
        return _first_image(value[0]) if value else ""
    if isinstance(value, dict):
        return _first_image(value.get("url") or value.get("imageUrl") or "")
    text = str(value or "")
    if text.startswith("//"):
        return f"https:{text}"
    if text and not text.startswith(("http://", "https://", "//")) and re.match(r"^[A-Za-z0-9_-]+$", text):
        return f"https://down-my.img.susercontent.com/file/{text}"
    return text


def _category_path(data: dict[str, Any]) -> list[str]:
    raw = _first_value(data, ["categoryPath", "categories", "breadcrumb", "breadcrumbs", "category"])
    if isinstance(raw, str):
        return [part.strip() for part in re.split(r">|/|\|", raw) if part.strip()]
    if isinstance(raw, list):
        path = []
        for item in raw:
            if isinstance(item, str):
                path.append(item)
            elif isinstance(item, dict):
                name = _first_value(item, ["name", "label", "displayName", "display_name"])
                if name:
                    path.append(str(name))
        return path
    if isinstance(raw, dict):
        name = _first_value(raw, ["name", "label", "displayName", "display_name"])
        return [str(name)] if name else []
    return []


def _options(row: dict[str, Any], tier_variations: list[dict[str, Any]] | None = None) -> dict[str, str]:
    tier_options = _tier_options(row, tier_variations or [])
    if tier_options:
        return tier_options

    raw = row.get("options") or row.get("attributes") or {}
    if isinstance(raw, dict):
        return {str(key): str(value) for key, value in raw.items() if value not in (None, "")}
    if isinstance(raw, list):
        options = {}
        for item in raw:
            if isinstance(item, dict):
                key = _first_value(item, ["name", "label", "key"]) or "Option"
                value = _first_value(item, ["value", "text", "label"])
                if value:
                    options[str(key)] = str(value)
        return options
    return {}


def _tier_options(row: dict[str, Any], tier_variations: list[dict[str, Any]]) -> dict[str, str]:
    tier_indexes = _tier_indexes(row)
    if not tier_indexes:
        return {}

    options = {}
    for tier_position, option_index in enumerate(tier_indexes):
        if tier_position >= len(tier_variations):
            continue
        variation = tier_variations[tier_position]
        values = variation.get("options")
        if not isinstance(values, list) or option_index >= len(values):
            continue
        key = _first_value(variation, ["name", "label"]) or f"Option {tier_position + 1}"
        value = values[option_index]
        if value:
            options[str(key)] = str(value)
    return options


def _tier_indexes(row: dict[str, Any]) -> list[int]:
    extinfo = row.get("extinfo") if isinstance(row.get("extinfo"), dict) else {}
    raw = extinfo.get("tier_index") or row.get("tier_index") or row.get("tierIndex")
    if not isinstance(raw, list):
        return []
    indexes = []
    for value in raw:
        try:
            indexes.append(int(value))
        except (TypeError, ValueError):
            continue
    return indexes


def _variant_image(row: dict[str, Any], tier_variations: list[dict[str, Any]]) -> str:
    direct = _first_image(_first_value(row, ["image", "imageUrl", "thumbUrl"]))
    if direct:
        return direct

    for tier_position, option_index in enumerate(_tier_indexes(row)):
        if tier_position >= len(tier_variations):
            continue
        images = tier_variations[tier_position].get("images")
        if isinstance(images, list) and option_index < len(images):
            image = _first_image(images[option_index])
            if image:
                return image
    return ""


def _available(row: dict[str, Any]) -> bool:
    if "available" in row:
        return bool(row["available"])
    stock = _first_value(row, ["stock", "quantity", "stockCount"])
    if stock is None:
        return True
    try:
        return int(stock) > 0
    except (TypeError, ValueError):
        return True


def _normalize_price(value: Any) -> str:
    if value in (None, ""):
        return ""
    if isinstance(value, dict):
        for key in ["single_value", "value", "price", "range_min", "min"]:
            normalized = _normalize_price(value.get(key))
            if normalized:
                return normalized
        return ""
    if isinstance(value, str):
        cleaned = re.sub(r"[^0-9.]", "", value.replace(",", ""))
        if not cleaned:
            return ""
        number = float(cleaned)
    else:
        number = float(value)
        if number >= 100000:
            number = number / 100000
    return f"{number:.2f}"

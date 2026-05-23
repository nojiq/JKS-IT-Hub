import unittest

from scraper.marketplaces import detect_marketplace, parse_product_html


SHOPEE_HTML = """
<html>
<head>
  <meta property="og:title" content="Fallback Mouse">
  <meta property="og:image" content="https://down-my.img.susercontent.com/file/fallback.webp">
</head>
<body>
<script>
window.__PRODUCT_STATE__ = {
  "product": {
    "productName": "Logitech M331 Silent Mouse",
    "shopName": "Logitech Official Store",
    "imageUrl": "https://down-my.img.susercontent.com/file/m331.webp",
    "categories": [{"name": "Computer Accessories"}, {"name": "Mouse"}],
    "models": [
      {
        "name": "Black",
        "price": 5990000,
        "currency": "MYR",
        "imageUrl": "https://down-my.img.susercontent.com/file/m331-black.webp",
        "stock": 10,
        "options": {"Color": "Black"}
      },
      {
        "name": "Red",
        "price": "64.90",
        "currency": "MYR",
        "stock": 0,
        "options": {"Color": "Red"}
      }
    ]
  }
};
</script>
</body>
</html>
"""


LAZADA_HTML = """
<html>
<head>
<script type="application/ld+json">
{
  "@context": "https://schema.org",
  "@type": "Product",
  "name": "Dell Latitude 5450",
  "image": ["https://img.lazcdn.com/g/laptop.jpg"],
  "category": "Computers / Laptops",
  "offers": {
    "@type": "Offer",
    "price": "3299.00",
    "priceCurrency": "MYR",
    "seller": {"name": "Dell Official Store"}
  }
}
</script>
</head>
<body></body>
</html>
"""


SHOPEE_MFE_HTML = """
<html>
<body>
<script type="text/mfe-initial-data" data-module="pdp">
{
  "initialState": {
    "DOMAIN_PDP": {
      "data": {
        "PDP_BFF_DATA": {
          "cachedMap": {
            "548465622/25092960501": {
              "item": {
                "name": "UGREEN Wireless Mouse",
                "image": "cn-11134207-7ras8-product",
                "currency": "MYR",
                "categories": [
                  {"display_name": "Computers & Accessories"},
                  {"display_name": "Keyboards & Mice"},
                  {"display_name": "Mice"}
                ],
                "models": [
                  {
                    "name": "Black",
                    "model_id": 242951904857,
                    "itemid": 25092960501,
                    "price": null,
                    "stock": 10,
                    "extinfo": {"tier_index": [0]}
                  },
                  {
                    "name": "Silver",
                    "price": null,
                    "stock": 0,
                    "extinfo": {"tier_index": [1]}
                  }
                ],
                "tier_variations": [
                  {
                    "name": "Color",
                    "options": ["Black", "Silver"],
                    "images": ["cn-11134207-7ras8-black", "cn-11134207-7ras8-silver"]
                  }
                ]
              },
              "shop_detailed": {"name": "HOYELO.my"}
            }
          }
        }
      }
    }
  }
}
</script>
</body>
</html>
"""


LAZADA_MODULE_HTML = """
<html>
<body>
<script>
var __moduleData__ = {
  "data": {
    "root": {
      "fields": {
        "tracking": {
          "pdt_name": "UGREEN USB Type C Cable",
          "pdt_photo": "//my-live-01.slatic.net/p/cable.jpg",
          "pdt_category": ["Mobiles & Tablets", "Accessories", "Cables"],
          "pdt_price": "RM7.99",
          "seller_name": "UGREEN Flagship",
          "core": {"currencyCode": "MYR"}
        },
        "product": {"title": "UGREEN USB Type C Cable"},
        "skuInfos": {
          "123": {
            "image": "//my-live-01.slatic.net/p/cable-black.jpg",
            "operation": {"disable": false},
            "price": "RM8.99"
          }
        },
        "productOption": {
          "skuBase": {
            "properties": [
              {"pid": "color", "name": "Color Family", "values": [
                {"vid": "black", "name": "Type C Black", "image": "//my-live-01.slatic.net/p/cable-black.jpg"}
              ]},
              {"pid": "length", "name": "Cable Length (M)", "values": [
                {"vid": "05", "name": "0.5"}
              ]}
            ],
            "skus": [
              {
                "skuId": "123",
                "itemId": "456",
                "sellerId": "789",
                "propPath": "color:black;length:05",
                "pagePath": "/products/cable-i456-s123.html"
              }
            ]
          }
        }
      }
    }
  }
};
</script>
</body>
</html>
"""


class MarketplaceParserTests(unittest.TestCase):
    def test_detects_supported_hosts(self):
        self.assertEqual(detect_marketplace("https://shopee.com.my/product/1/2"), "SHOPEE")
        self.assertEqual(detect_marketplace("https://www.lazada.com.my/products/a.html"), "LAZADA")
        self.assertIsNone(detect_marketplace("https://example.com/item"))

    def test_parses_shopee_embedded_variants(self):
        preview = parse_product_html("https://shopee.com.my/product/1/2", SHOPEE_HTML)

        self.assertEqual(preview["marketplace"], "SHOPEE")
        self.assertEqual(preview["name"], "Logitech M331 Silent Mouse")
        self.assertEqual(preview["vendorName"], "Logitech Official Store")
        self.assertEqual(preview["categoryPath"], ["Computer Accessories", "Mouse"])
        self.assertEqual(preview["variants"][0]["label"], "Black")
        self.assertEqual(preview["variants"][0]["price"], "59.90")
        self.assertEqual(preview["variants"][0]["available"], True)
        self.assertEqual(preview["variants"][1]["available"], False)

    def test_parses_lazada_json_ld_base_price(self):
        preview = parse_product_html("https://www.lazada.com.my/products/dell-i1.html", LAZADA_HTML)

        self.assertEqual(preview["marketplace"], "LAZADA")
        self.assertEqual(preview["name"], "Dell Latitude 5450")
        self.assertEqual(preview["vendorName"], "Dell Official Store")
        self.assertEqual(preview["categoryPath"], ["Computers", "Laptops"])
        self.assertEqual(preview["variants"][0]["price"], "3299.00")
        self.assertEqual(preview["variants"][0]["currency"], "MYR")

    def test_parses_shopee_mfe_product_even_when_price_is_removed(self):
        preview = parse_product_html(
            "https://shopee.com.my/UGREEN-i.548465622.25092960501",
            SHOPEE_MFE_HTML,
        )

        self.assertEqual(preview["name"], "UGREEN Wireless Mouse")
        self.assertEqual(preview["vendorName"], "HOYELO.my")
        self.assertEqual(preview["categoryPath"], ["Computers & Accessories", "Keyboards & Mice", "Mice"])
        self.assertEqual(preview["imageUrl"], "https://down-my.img.susercontent.com/file/cn-11134207-7ras8-product")
        self.assertEqual(preview["variants"][0]["label"], "Black")
        self.assertEqual(preview["variants"][0]["options"], {"Color": "Black"})
        self.assertEqual(preview["variants"][0]["imageUrl"], "https://down-my.img.susercontent.com/file/cn-11134207-7ras8-black")
        self.assertEqual(preview["variants"][0]["price"], "")
        self.assertEqual(preview["variants"][0]["modelId"], "242951904857")
        self.assertEqual(preview["variants"][0]["itemId"], "25092960501")
        self.assertEqual(preview["variants"][1]["available"], False)
        self.assertEqual(preview["confidence"], "partial")
        self.assertEqual(preview["warnings"], ["Variant prices were not available from marketplace response."])

    def test_parses_lazada_module_dynamic_sku_groups(self):
        preview = parse_product_html(
            "https://www.lazada.com.my/products/cable-i456.html",
            LAZADA_MODULE_HTML,
        )

        self.assertEqual(preview["marketplace"], "LAZADA")
        self.assertEqual(preview["name"], "UGREEN USB Type C Cable")
        self.assertEqual(preview["vendorName"], "UGREEN Flagship")
        self.assertEqual(preview["categoryPath"], ["Mobiles & Tablets", "Accessories", "Cables"])
        self.assertEqual(preview["variants"][0]["label"], "Type C Black / 0.5")
        self.assertEqual(preview["variants"][0]["options"], {
            "Color Family": "Type C Black",
            "Cable Length (M)": "0.5",
        })
        self.assertEqual(preview["variants"][0]["price"], "8.99")
        self.assertEqual(preview["variants"][0]["skuId"], "123")
        self.assertEqual(preview["variants"][0]["sourceVariantUrl"], "https://www.lazada.com.my/products/cable-i456-s123.html")


if __name__ == "__main__":
    unittest.main()

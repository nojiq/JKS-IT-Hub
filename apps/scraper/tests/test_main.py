import unittest

from main import _response_html


class ResponseHtmlTests(unittest.TestCase):
    def test_prefers_html_content_when_text_is_empty(self):
        class Page:
            html_content = "<html><title>Product</title></html>"
            text = ""
            body = b""

        self.assertEqual(_response_html(Page()), "<html><title>Product</title></html>")


if __name__ == "__main__":
    unittest.main()

import importlib.util
import unittest


class ScraperDependencyTests(unittest.TestCase):
    def test_scrapling_http_fetcher_dependency_is_installed(self):
        self.assertIsNotNone(importlib.util.find_spec("curl_cffi"))

    def test_scrapling_fetcher_imports(self):
        from scrapling.fetchers import Fetcher

        self.assertIsNotNone(Fetcher)


if __name__ == "__main__":
    unittest.main()

"""Servidor de distribuição para QA, com os cabeçalhos de atualização da Vercel."""
import argparse
from functools import partial
from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer
from urllib.parse import urlsplit


class ReleaseHandler(SimpleHTTPRequestHandler):
    def send_head(self):
        path = urlsplit(self.path).path
        if path in {"/sw.js", "/version.json"}:
            # O hosting publica esses recursos sem cache; não simular uma
            # resposta 304 só porque os builds de teste têm o mesmo mtime.
            for header in ("If-Modified-Since", "If-None-Match"):
                if header in self.headers:
                    del self.headers[header]
        return super().send_head()

    def end_headers(self):
        path = urlsplit(self.path).path
        if path == "/sw.js":
            self.send_header("Cache-Control", "no-cache, no-store, must-revalidate")
        elif path in {"/index.html", "/version.json"}:
            self.send_header("Cache-Control", "no-cache, must-revalidate")
        super().end_headers()


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--directory", required=True)
    parser.add_argument("--port", type=int, default=8767)
    parser.add_argument("--host", default="127.0.0.1")
    args = parser.parse_args()
    handler = partial(ReleaseHandler, directory=args.directory)
    with ThreadingHTTPServer((args.host, args.port), handler) as server:
        server.serve_forever()


if __name__ == "__main__":
    main()

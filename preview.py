#!/usr/bin/env python3
"""Static preview with a one-time save for cms/auth.json."""
import json
import os
import re
from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer

ROOT = os.path.dirname(os.path.abspath(__file__))
AUTH = os.path.join(ROOT, "cms", "auth.json")


class Handler(SimpleHTTPRequestHandler):
    def do_POST(self):
        path = self.path.split("?", 1)[0]
        if path != "/cms/auth.json":
            self.send_error(404)
            return
        if os.path.exists(AUTH):
            self.send_error(409)
            return
        length = int(self.headers.get("Content-Length", "0") or "0")
        if length <= 0 or length > 2000:
            self.send_error(400)
            return
        try:
            data = json.loads(self.rfile.read(length).decode("utf-8"))
        except (UnicodeError, json.JSONDecodeError):
            self.send_error(400)
            return
        if not isinstance(data, dict) or set(data) != {"username", "salt", "password_hash"}:
            self.send_error(400)
            return
        username = str(data["username"])
        salt = str(data["salt"])
        digest = str(data["password_hash"])
        if not re.fullmatch(r"[a-z0-9._-]{3,40}", username):
            self.send_error(400)
            return
        if not re.fullmatch(r"[a-f0-9]{32}", salt) or not re.fullmatch(r"[a-f0-9]{64}", digest):
            self.send_error(400)
            return
        with open(AUTH, "w", encoding="utf-8") as handle:
            json.dump(
                {"username": username, "salt": salt, "password_hash": digest},
                handle,
                ensure_ascii=False,
            )
            handle.write("\n")
        self.send_response(204)
        self.end_headers()


if __name__ == "__main__":
    os.chdir(ROOT)
    ThreadingHTTPServer(("127.0.0.1", 8080), Handler).serve_forever()

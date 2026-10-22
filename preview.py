#!/usr/bin/env python3
"""Static preview with a one-time save for cms/auth.json."""
import json
import os
import re
from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer

ROOT = os.path.dirname(os.path.abspath(__file__))
AUTH = os.path.join(ROOT, "cms", "auth.json")


FILE_PATH = re.compile(
    r"^(?:content/posts\.json|index\.html|en/index\.html|blog/index\.html|en/blog-2/index\.html|assets/images/blog/[A-Za-z0-9._-]+|[a-z0-9]+(?:-[a-z0-9]+)*/index\.html)$"
)
DELETE_PATH = re.compile(r"^[a-z0-9]+(?:-[a-z0-9]+)*/index\.html$")


def account_ready(path):
    if not os.path.isfile(path):
        return False
    try:
        with open(path, encoding="utf-8") as handle:
            data = json.load(handle)
    except (OSError, json.JSONDecodeError):
        return False
    if not isinstance(data, dict):
        return False
    username = str(data.get("username", ""))
    salt = str(data.get("salt", ""))
    digest = str(data.get("password_hash", ""))
    return bool(
        re.fullmatch(r"[a-z0-9._-]{3,40}", username)
        and re.fullmatch(r"[a-f0-9]{32}", salt)
        and re.fullmatch(r"[a-f0-9]{64}", digest)
    )


def inside_root(rel):
    rel = str(rel).replace("\\", "/").lstrip("/")
    if not FILE_PATH.fullmatch(rel):
        return None
    full = os.path.realpath(os.path.join(ROOT, rel))
    root = os.path.realpath(ROOT)
    if full != root and not full.startswith(root + os.sep):
        return None
    return full


class Handler(SimpleHTTPRequestHandler):
    def do_POST(self):
        path = self.path.split("?", 1)[0]
        if path == "/cms/auth.json":
            self.save_account()
            return
        if path == "/cms/save":
            self.save_files()
            return
        self.send_error(404)

    def read_json(self, limit):
        length = int(self.headers.get("Content-Length", "0") or "0")
        if length <= 0 or length > limit:
            self.send_error(400)
            return None
        try:
            return json.loads(self.rfile.read(length).decode("utf-8"))
        except (UnicodeError, json.JSONDecodeError):
            self.send_error(400)
            return None

    def save_account(self):
        if account_ready(AUTH):
            self.send_error(409)
            return
        data = self.read_json(2000)
        if data is None:
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

    def save_files(self):
        data = self.read_json(12_000_000)
        if data is None:
            return
        files = data.get("files") if isinstance(data, dict) else None
        deletions = data.get("delete") if isinstance(data, dict) else None
        if not isinstance(files, list) or not isinstance(deletions, list):
            self.send_error(400)
            return
        planned = []
        for item in files:
            if not isinstance(item, dict):
                self.send_error(400)
                return
            target = inside_root(item.get("path", ""))
            content = item.get("content")
            if target is None or not isinstance(content, str):
                self.send_error(400)
                return
            if item.get("encoding") == "base64":
                try:
                    payload = __import__("base64").b64decode(content, validate=True)
                except Exception:
                    self.send_error(400)
                    return
                planned.append((target, payload, "wb"))
            else:
                planned.append((target, content.encode("utf-8"), "wb"))
        removed = []
        for rel in deletions:
            if not isinstance(rel, str) or not DELETE_PATH.fullmatch(rel):
                self.send_error(400)
                return
            target = inside_root(rel)
            if target is None:
                self.send_error(400)
                return
            removed.append(target)
        for target, payload, mode in planned:
            os.makedirs(os.path.dirname(target), exist_ok=True)
            with open(target, mode) as handle:
                handle.write(payload)
        for target in removed:
            if os.path.isfile(target):
                os.remove(target)
            folder = os.path.dirname(target)
            if os.path.isdir(folder) and not os.listdir(folder):
                os.rmdir(folder)
        self.send_response(204)
        self.end_headers()


if __name__ == "__main__":
    os.chdir(ROOT)
    ThreadingHTTPServer(("127.0.0.1", 8080), Handler).serve_forever()

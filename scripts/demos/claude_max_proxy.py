#!/usr/bin/env python3
"""Local proxy: Anthropic Messages API -> `claude` CLI (Claude Max subscription).

EXPERIMENTAL / DEV-ONLY build tool. Lets the FOLIO Mapper backend's
AnthropicProvider (which uses the official `anthropic` SDK) route its calls to
the locally-authenticated `claude` CLI instead of api.anthropic.com, so demo
curation runs on the operator's Claude Max plan with no metered API key.

The `anthropic` SDK honors the ANTHROPIC_BASE_URL env var, so wiring is:

    1. Start this proxy:        python scripts/demos/claude_max_proxy.py
    2. Start the backend with:  ANTHROPIC_BASE_URL=http://127.0.0.1:8788
    3. Curate as usual:         curate_demos.py --area X --provider anthropic
       (ANTHROPIC_API_KEY can be any non-empty dummy; the proxy ignores it and
        authenticates via the `claude` CLI / Max subscription.)

Caveats: unofficial, fragile (depends on `claude` CLI output format), and the
served model is whatever the Max plan maps `--model sonnet` to (currently
Sonnet 4.x). The recorded demo.json model still reflects the llm_config value.
"""

from __future__ import annotations

import json
import os
import subprocess
import sys
import threading
import uuid
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer

PORT = int(os.environ.get("CLAUDE_PROXY_PORT", "8788"))
WORKDIR = os.environ.get("CLAUDE_PROXY_WORKDIR", "/tmp/folio-proxy-wd")
TIMEOUT = int(os.environ.get("CLAUDE_PROXY_TIMEOUT", "300"))
# Serialize/limit concurrent `claude` invocations to stay friendly with the
# subscription's session limits. 2 is a safe default.
_sem = threading.Semaphore(int(os.environ.get("CLAUDE_PROXY_CONCURRENCY", "2")))
_call_count = 0
_count_lock = threading.Lock()


def _map_model(requested: str | None) -> str:
    m = (requested or "").lower()
    if "haiku" in m:
        return "haiku"
    if "opus" in m:
        return "opus"
    return "sonnet"


def _content_to_text(content) -> str:
    """Anthropic `content` may be a string or a list of content blocks."""
    if content is None:
        return ""
    if isinstance(content, str):
        return content
    if isinstance(content, list):
        parts = []
        for block in content:
            if isinstance(block, dict):
                if block.get("type") == "text":
                    parts.append(block.get("text", ""))
                else:
                    parts.append(json.dumps(block))
            else:
                parts.append(str(block))
        return "\n".join(parts)
    return str(content)


def _system_text(system) -> str | None:
    if system is None:
        return None
    if isinstance(system, str):
        return system
    if isinstance(system, list):
        return "\n".join(
            b if isinstance(b, str) else _content_to_text([b]) for b in system
        )
    return str(system)


def _build_prompt(messages: list) -> str:
    """Single-turn -> raw content. Multi-turn -> labeled transcript."""
    if not messages:
        return ""
    if len(messages) == 1:
        return _content_to_text(messages[0].get("content", ""))
    lines = []
    for msg in messages:
        role = (msg.get("role") or "user").upper()
        lines.append(f"{role}: {_content_to_text(msg.get('content', ''))}")
    return "\n\n".join(lines)


def call_claude(system: str | None, prompt: str, model: str) -> tuple[str, dict]:
    cmd = [
        "claude", "-p",
        "--output-format", "json",
        "--model", model,
        "--no-session-persistence",
    ]
    if system:
        cmd += ["--system-prompt", system]
    with _sem:
        proc = subprocess.run(
            cmd,
            input=prompt,
            capture_output=True,
            text=True,
            cwd=WORKDIR,
            timeout=TIMEOUT,
        )
    if proc.returncode != 0:
        raise RuntimeError(
            f"claude CLI failed rc={proc.returncode}: {proc.stderr[:500]}"
        )
    try:
        data = json.loads(proc.stdout)
    except json.JSONDecodeError as e:
        raise RuntimeError(f"claude CLI returned non-JSON: {proc.stdout[:500]}") from e
    if data.get("is_error"):
        raise RuntimeError(f"claude CLI error: {str(data.get('result'))[:500]}")
    return data.get("result", ""), data.get("usage", {})


class Handler(BaseHTTPRequestHandler):
    def log_message(self, *args):  # quiet
        pass

    def _send(self, code: int, obj: dict):
        body = json.dumps(obj).encode()
        self.send_response(code)
        self.send_header("Content-Type", "application/json")
        self.send_header("Content-Length", str(len(body)))
        self.send_header("anthropic-version", "2023-06-01")
        self.end_headers()
        self.wfile.write(body)

    def do_GET(self):
        # Minimal health endpoint.
        self._send(200, {"status": "ok", "calls": _call_count})

    def do_POST(self):
        global _call_count
        length = int(self.headers.get("Content-Length", "0"))
        raw = self.rfile.read(length) if length else b""
        try:
            req = json.loads(raw)
        except Exception as e:
            self._send(400, {"type": "error", "error": {"type": "invalid_request_error", "message": str(e)}})
            return

        model_req = req.get("model", "claude-3-5-sonnet-latest")
        system = _system_text(req.get("system"))
        prompt = _build_prompt(req.get("messages", []))

        try:
            text, usage = call_claude(system, prompt, _map_model(model_req))
        except Exception as e:
            sys.stderr.write(f"[proxy] ERROR: {e}\n")
            sys.stderr.flush()
            self._send(500, {"type": "error", "error": {"type": "api_error", "message": str(e)}})
            return

        with _count_lock:
            _call_count += 1
            n = _call_count
        sys.stderr.write(f"[proxy] call #{n} model={_map_model(model_req)} "
                         f"in~{usage.get('input_tokens', '?')} out~{usage.get('output_tokens', '?')} "
                         f"chars={len(text)}\n")
        sys.stderr.flush()

        self._send(200, {
            "id": f"msg_{uuid.uuid4().hex[:24]}",
            "type": "message",
            "role": "assistant",
            "model": model_req,
            "content": [{"type": "text", "text": text}],
            "stop_reason": "end_turn",
            "stop_sequence": None,
            "usage": {
                "input_tokens": int(usage.get("input_tokens", 0) or 0),
                "output_tokens": int(usage.get("output_tokens", 0) or 0),
            },
        })


def main() -> int:
    os.makedirs(WORKDIR, exist_ok=True)
    srv = ThreadingHTTPServer(("127.0.0.1", PORT), Handler)
    sys.stderr.write(f"[proxy] claude-max proxy listening on http://127.0.0.1:{PORT} "
                     f"(workdir={WORKDIR}, concurrency={_sem._value})\n")
    sys.stderr.flush()
    try:
        srv.serve_forever()
    except KeyboardInterrupt:
        pass
    return 0


if __name__ == "__main__":
    sys.exit(main())

#!/usr/bin/env python3
"""Vigila que el código de producción lo escriban los agentes de implementación.

`CLAUDE.md` dice que las tareas van por `frontend` y `backend`, pero **la configuración de
sesión puede impedir lanzar subagentes y gana ella, en silencio**: eso ya pasó una vez y costó
las diez tareas de una spec entera hechas por el orchestrator, sin contrato de parada.

Este hook no lo impide —bloquear estorbaría en arreglos triviales—; lo hace **visible y medible**:

- registra cada escritura bajo los territorios delegables en `.claude/delegation.jsonl`, anotando
  si vino del agente principal o de un subagente;
- avisa **una sola vez por sesión** cuando el agente principal escribe ahí.

Se engancha como `PreToolUse` con matcher `Write|Edit|NotebookEdit`. Nunca bloquea y nunca falla
hacia fuera: ante cualquier error sale 0 y deja pasar la llamada.

Ratio de delegación de una sesión:
    python3 -c "import json,collections;print(collections.Counter(json.loads(l)['agent'] for l in open('.claude/delegation.jsonl')))"
"""

import json
import os
import sys
import tempfile
from datetime import datetime, timezone

ROOT = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
LOG = os.path.join(ROOT, ".claude", "delegation.jsonl")

# Territorios que un agente de implementación debería estar cubriendo. Al portar, sustituir.
TERRITORIOS = ("apps/web/", "apps/api/", "packages/shared/")

AVISO = (
    "Estás escribiendo código de producción desde el agente principal. Según CLAUDE.md esto es "
    "trabajo de `frontend`/`backend`, y con ello se pierde el contrato de parada, que es el "
    "mecanismo que más defectos ha encontrado en este repositorio. Si la delegación está apagada "
    "por configuración de sesión, dilo antes de seguir: es una decisión del usuario, no un detalle. "
    "(Este aviso sale una vez por sesión; queda registro en .claude/delegation.jsonl.)"
)


def relativo(path: str) -> str | None:
    if not path:
        return None
    try:
        rel = os.path.relpath(os.path.abspath(path), ROOT)
    except ValueError:
        return None
    return None if rel.startswith("..") else rel.replace(os.sep, "/")


def main() -> None:
    payload = json.loads(sys.stdin.read())
    rel = relativo((payload.get("tool_input") or {}).get("file_path", ""))
    if not rel or not rel.startswith(TERRITORIOS):
        return

    # `agent_type` solo existe cuando la llamada nace dentro de un subagente.
    agente = payload.get("agent_type", "main")
    sesion = payload.get("session_id", "?")
    with open(LOG, "a", encoding="utf-8") as fh:
        fh.write(json.dumps({
            "ts": datetime.now(timezone.utc).isoformat(timespec="seconds"),
            "agent": agente,
            "file": rel,
            "tool": payload.get("tool_name", "?"),
            "session": sesion,
        }, ensure_ascii=False) + "\n")

    if agente != "main":
        return

    # Un aviso por sesión: repetirlo en cada escritura lo convertiría en ruido, y el ruido se ignora.
    marca = os.path.join(tempfile.gettempdir(), f"om-delegation-{sesion}.marker")
    if os.path.exists(marca):
        return
    open(marca, "w").close()
    print(json.dumps({
        "systemMessage": "Delegación: escritura en territorio de subagente desde el agente principal.",
        "hookSpecificOutput": {"hookEventName": "PreToolUse", "additionalContext": AVISO},
    }))


try:
    main()
except Exception:
    pass
sys.exit(0)

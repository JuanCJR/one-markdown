#!/usr/bin/env python3
"""Registra cada invocación de skill en `.claude/skill-usage.jsonl`.

Existe para que la próxima retrospectiva mida el uso de skills con datos de este
repositorio, y no con el contador global de `~/.claude.json` —que mezcla todos los
proyectos y no distingue quién invocó—.

Se engancha como hook `PostToolUse` con matcher `Skill`. Nunca falla hacia fuera:
cualquier error se traga y sale 0, porque un hook que rompe una llamada de
herramienta cuesta más que el dato que recoge.

Cada línea es un objeto JSON:
    ts      instante ISO-8601 de la invocación
    skill   nombre de la skill invocada
    agent   `main` si la invocó el agente principal, o el tipo de subagente
    session id de sesión, para separar corridas
"""

import json
import os
import sys
from datetime import datetime, timezone

LOG = os.path.join(
    os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__)))),
    ".claude",
    "skill-usage.jsonl",
)


def main() -> None:
    payload = json.loads(sys.stdin.read())
    entry = {
        "ts": datetime.now(timezone.utc).isoformat(timespec="seconds"),
        "skill": (payload.get("tool_input") or {}).get("skill", "?"),
        # `agent_type` solo viene cuando la llamada nace dentro de un subagente.
        "agent": payload.get("agent_type", "main"),
        "session": payload.get("session_id", "?"),
    }
    with open(LOG, "a", encoding="utf-8") as fh:
        fh.write(json.dumps(entry, ensure_ascii=False) + "\n")


try:
    main()
except Exception:
    pass
sys.exit(0)

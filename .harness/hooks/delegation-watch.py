#!/usr/bin/env python3
"""Vigila quién escribe el código de producción: quien ejecuta las tareas, o quien las escribe.

El método manda delegar, pero **la configuración de sesión puede impedirlo, en silencio**. Cuando
eso pasó, una spec entera se implementó sin contrato de parada y no se notó hasta la retrospectiva.

Este hook no lo impide —bloquear estorbaría en arreglos triviales, y el método premia parar y
avisar, no impedir—: lo hace **visible y medible**. Registra cada escritura en territorio delegable
y avisa **una vez por sesión** cuando quien escribe es el agente principal. Un aviso repetido es
ruido, y el ruido se ignora.

**El ratio de delegación solo es medible donde la herramienta manda el identificador de agente.**
Donde no lo manda, la línea queda con `agent: null` y eso significa *no medible*, no cero. Ver
`_payload`: aquí no se rellena nada por defecto.

    python3 -c "import json,collections;print(collections.Counter(json.loads(l)['agent'] for l in open('.harness/delegation.jsonl')))"
"""

import json
import os
import sys
import tempfile

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import _payload

AVISO = (
    "Estás escribiendo código de producción desde el agente principal. Según el método esto es "
    "trabajo de quien ejecuta las tareas, y con ello se pierde el contrato de parada, que es el "
    "mecanismo que más defectos encuentra. Si la delegación está apagada por configuración de "
    "sesión, dilo antes de seguir: es una decisión de quien dirige, no un detalle. "
    "(Este aviso sale una vez por sesión; queda registro en la medición.)"
)


def relativo(path):
    if not path:
        return None
    try:
        rel = os.path.relpath(os.path.abspath(path), os.getcwd())
    except ValueError:
        return None
    return None if rel.startswith("..") else rel.replace(os.sep, "/")


def main() -> None:
    campos = _payload.leer(sys.stdin.read())
    territorios = tuple(_payload.config().get("territorios") or ())

    rel = relativo(campos["file"])
    # Sin territorios configurados se registra todo: es mejor medir de más que no medir.
    if rel is None or (territorios and not rel.startswith(territorios)):
        return

    entrada = {
        "agent": campos["agent"],
        "file": rel,
        "tool": campos["tool"],
        "session": campos["session"],
        "_esquema": campos["_esquema"],
    }
    if "_claves" in campos:
        entrada["_claves"] = campos["_claves"]
    _payload.anota("delegation.jsonl", entrada)

    # Solo se avisa cuando **consta** que escribió el principal. Si el agente es nulo no se sabe, y
    # avisar «por si acaso» enseñaría a ignorar el aviso.
    if campos["agent"] != "main":
        return

    marca = os.path.join(tempfile.gettempdir(), f"showi-deleg-{campos['session']}.marker")
    if os.path.exists(marca):
        return
    open(marca, "w").close()
    print(json.dumps({
        "systemMessage": "Delegación: escritura en territorio delegable desde el agente principal.",
        "hookSpecificOutput": {"hookEventName": "PreToolUse", "additionalContext": AVISO},
    }))


try:
    main()
except Exception:
    pass
sys.exit(0)

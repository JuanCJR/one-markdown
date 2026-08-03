#!/usr/bin/env python3
"""Registra cada invocación de skill, para saber qué skills se usan **de verdad**.

Existe porque se concluyó que «las skills no se usan» a partir de un contador que valía cero
**porque las skills estaban apagadas en la configuración**. Las diez con cero invocaciones eran
exactamente las diez apagadas: ese cero no medía nada.

Se engancha al evento posterior al uso de una herramienta, con matcher `Skill`. Nunca falla hacia
fuera: cualquier error se traga y sale 0, porque un hook que rompe una llamada cuesta más que el
dato que recoge.

Un campo que no se puede resolver se escribe nulo. **Jamás un valor por defecto**: ver `_payload`.

    python3 -c "import json,collections;print(collections.Counter(json.loads(l)['skill'] for l in open('.harness/skill-usage.jsonl')))"
"""

import os
import sys

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import _payload


def main() -> None:
    campos = _payload.leer(sys.stdin.read())
    entrada = {
        "skill": campos["skill"],
        "agent": campos["agent"],
        "session": campos["session"],
        "_esquema": campos["_esquema"],
    }
    if "_claves" in campos:
        entrada["_claves"] = campos["_claves"]
    _payload.anota("skill-usage.jsonl", entrada)


try:
    main()
except Exception:
    pass
sys.exit(0)

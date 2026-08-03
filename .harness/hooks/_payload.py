"""Lectura del payload de un hook, sea cual sea la herramienta que lo envía.

Cada herramienta manda su propio JSON por la entrada estándar y no hay estándar que los unifique.
Este módulo prueba varias rutas por campo y se queda con la primera que resuelve.

**La regla que hace esto honesto**: cuando un campo no resuelve se escribe `None`, **nunca un valor
por defecto**. Un identificador de agente inventado produciría un ratio de delegación que mide la
imaginación de este fichero en vez del repositorio — y ése es literalmente el defecto que costó dos
conclusiones falsas en una retrospectiva anterior.

**El modo sonda**: cuando no se reconoce el esquema, la línea registrada lo dice y adjunta las
claves que traía. Ésas son el mapa del payload real, y con ellas se añade la ruta y se publica un
parche. Sin ellas habría que adivinar, que es lo que no se hace aquí.
"""

import json
import os

# Orden de intento por campo. La primera ruta que resuelve gana.
RUTAS = {
    "file": [
        ("tool_input", "file_path"),
        ("toolInput", "filePath"),
        ("tool_input", "path"),
        ("input", "path"),
        ("tool", "input", "file_path"),
        ("file_path",),
        ("filePath",),
    ],
    "skill": [
        ("tool_input", "skill"),
        ("toolInput", "skill"),
        ("input", "skill"),
        ("skill",),
    ],
    "tool": [("tool_name",), ("toolName",), ("tool", "name"), ("name",)],
    # `agent` es el que más importa y el que menos herramientas mandan. Ver la regla de arriba.
    "agent": [("agent_type",), ("agentType",), ("subagent",), ("input", "agent")],
    "session": [("session_id",), ("sessionId",), ("conversation_id",), ("conversationId",)],
}

# Algunas herramientas pasan datos por entorno en vez de por el payload.
ENV = {
    "file": ["SHOWI_FILE_PATH", "KIRO_FILE_PATH", "CURSOR_FILE"],
    "session": ["SHOWI_SESSION_ID", "KIRO_SESSION_ID"],
}

# Marcas que identifican de quién viene el payload. Solo sirven para saber si sabemos leerlo.
FIRMAS = {
    "claudecode": ("tool_name", "tool_input"),
    "camel": ("toolName", "toolInput"),
    "anidado": ("tool",),
}

MAX_CLAVES = 20


def _por_ruta(datos, ruta):
    actual = datos
    for paso in ruta:
        if not isinstance(actual, dict):
            return None
        actual = actual.get(paso)
    return actual if isinstance(actual, (str, int, float)) else None


def _por_entorno(nombres):
    for nombre in nombres:
        valor = os.environ.get(nombre)
        if valor:
            return valor
    return None


def _esquema(datos):
    for nombre, claves in FIRMAS.items():
        if all(clave in datos for clave in claves):
            return nombre
    return "desconocido"


def leer(crudo: str) -> dict:
    """Devuelve los campos que se hayan podido resolver; los demás, `None`."""
    try:
        datos = json.loads(crudo)
    except Exception:
        datos = None
    if not isinstance(datos, dict):
        datos = {}

    campos = {}
    for campo, rutas in RUTAS.items():
        valor = None
        for ruta in rutas:
            valor = _por_ruta(datos, ruta)
            if valor is not None:
                break
        campos[campo] = valor if valor is not None else _por_entorno(ENV.get(campo, []))

    campos["_esquema"] = _esquema(datos)
    if campos["_esquema"] == "desconocido":
        # La sonda. No se inventa un dato: se registra que no se sabe leerlo, y con qué venía.
        campos["_claves"] = sorted(datos.keys())[:MAX_CLAVES]
    return campos


def destino() -> str:
    """Dónde se escribe la medición. Lo fija el perfil; el entorno permite apuntarlo en un test."""
    return os.environ.get("SHOWI_DESTINO") or ".harness"


def config() -> dict:
    """Lo que `showi sync` dejó escrito para los hooks: territorios y textos del proyecto."""
    try:
        with open(os.path.join(destino(), "config.json"), encoding="utf-8") as fh:
            return json.load(fh)
    except Exception:
        return {}


def anota(fichero: str, entrada: dict) -> None:
    """Añade una línea al registro. Crea el directorio si hace falta y nunca lanza hacia fuera."""
    from datetime import datetime, timezone

    ruta = os.path.join(destino(), fichero)
    os.makedirs(os.path.dirname(ruta) or ".", exist_ok=True)
    entrada = {"ts": datetime.now(timezone.utc).isoformat(timespec="seconds"), **entrada}
    with open(ruta, "a", encoding="utf-8") as fh:
        fh.write(json.dumps(entrada, ensure_ascii=False) + "\n")

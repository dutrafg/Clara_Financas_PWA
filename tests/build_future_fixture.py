"""Gera o próximo release do Clara a partir da branch em teste, sem tocar na main."""
import json
import re
import subprocess
from pathlib import Path

TARGET=Path("qa-upgrade/next")
package=json.loads((TARGET/"package.json").read_text())
current=package["version"]
match=re.fullmatch(r"(\d+)\.(\d+)\.(\d+)(-.+)?",current)
if not match:
    raise SystemExit("Versão inválida: "+current)
future=f"{match[1]}.{match[2]}.{int(match[3])+1}{match[4] or ''}"
meta=json.loads((TARGET/"version.json").read_text())
assert meta["version"]==current
package["version"]=future
meta["version"]=future
meta["notes"]=["Pacote futuro para validação de atualização PWA."]
(TARGET/"package.json").write_text(json.dumps(package,ensure_ascii=False,indent=2)+"\n")
(TARGET/"version.json").write_text(json.dumps(meta,ensure_ascii=False,indent=2)+"\n")
html=(TARGET/"index.html").read_text()
before=f"const CLARA_APP_VERSION='{current}';"
assert before in html
html=html.replace(before,f"const CLARA_APP_VERSION='{future}';")
html=html.replace("Clara Finanças RC"+current.split("-")[0],"Clara Finanças RC"+future.split("-")[0])
(TARGET/"index.html").write_text(html)
subprocess.run(["npm","run","build"],cwd=TARGET,check=True)
new_meta=json.loads((TARGET/"dist/version.json").read_text())
assert new_meta["version"]==future and new_meta["cache"].startswith("clara-v2-")
print(f"FUTURE BUILD OK: {current} → {future}, cache {new_meta['cache']}")

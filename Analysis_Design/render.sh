#!/usr/bin/env bash
# Xuất mọi sơ đồ .puml trong Analysis_Design ra PNG (cùng thư mục với file nguồn).
# Cần: Java, plantuml.jar, Graphviz. Ghi đè đường dẫn bằng biến PLANTUML_JAR và GRAPHVIZ_DOT.
# Cách dùng: bash Analysis_Design/render.sh [file.puml ...]
set -euo pipefail
cd "$(dirname "$0")"
JAR="${PLANTUML_JAR:-$HOME/.plantuml/plantuml.jar}"
export GRAPHVIZ_DOT="${GRAPHVIZ_DOT:-$HOME/.plantuml/graphviz/Graphviz-12.2.1-win64/bin/dot.exe}"
files=("$@")
[ ${#files[@]} -eq 0 ] && mapfile -t files < <(find . -name '*.puml' | sort)
java -DPLANTUML_LIMIT_SIZE=16384 -jar "$JAR" -charset UTF-8 -tpng -failfast2 "${files[@]}"
echo "Đã xuất ${#files[@]} sơ đồ."

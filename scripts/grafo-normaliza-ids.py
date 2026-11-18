#!/usr/bin/env python3
"""Tira o caminho da maquina de dentro dos identificadores do grafo.

O QUE ESTE SCRIPT RESOLVE (medido em 27/07/2026, ver GRAFO-ID-ABSOLUTO.md)

Numa atualizacao incremental do grafo (`/graphify --update`), o extrator de
codigo recebe a lista dos arquivos que MUDARAM. Ele monta os identificadores a
partir do caminho recebido — que vem absoluto — e, no fim, troca a forma
absoluta pela relativa. So que essa troca so alcanca os arquivos da lista: uma
aresta que sai de um arquivo alterado e aponta para um arquivo NAO alterado
guarda o alvo na forma absoluta,

    users_exemplo_desktop_previsao_eventos_src_lib_protecao_loadsnapshots

enquanto o no de verdade se chama `src_lib_protecao_loadsnapshots`. O alvo nao
existe, e a montagem do grafo descarta a aresta sem dizer nada.

Este script roda no NOSSO lado do fluxo — depois da extracao, antes da juncao —
e refaz o mesmo mapeamento que o extrator faz, so que com o corpus INTEIRO
(`all_files` do detect), nao apenas com os arquivos alterados. Nao altera o
pacote graphify instalado: ele e atualizado por fora e qualquer remendo dentro
dele se perde na proxima atualizacao.

COMO USAR (a partir da raiz do repositorio)

    python3 scripts/grafo-normaliza-ids.py --verificar graphify-out/.graphify_ast.json
    python3 scripts/grafo-normaliza-ids.py --corrigir  graphify-out/.graphify_ast.json

`--verificar` nao escreve nada e devolve 1 quando ainda ha caminho de maquina
colado num identificador. `--corrigir` reescreve o arquivo e diz quantos nos e
quantas pontas de aresta arrumou.

O interpretador tem de ser o do graphify (o script importa `graphify.ids`):

    $(cat graphify-out/.graphify_python) scripts/grafo-normaliza-ids.py ...
"""
from __future__ import annotations

import argparse
import json
import sys
from pathlib import Path

try:
    from graphify.ids import make_id
except ImportError:  # pragma: no cover - depende do interpretador escolhido
    print(
        "Erro: nao consegui importar `graphify.ids`. Rode este script com o\n"
        "interpretador do graphify:\n"
        "    $(cat graphify-out/.graphify_python) scripts/grafo-normaliza-ids.py ...",
        file=sys.stderr,
    )
    raise SystemExit(2)


def raiz_do_stem(caminho: Path) -> str:
    """Caminho sem a extensao, em barras — a forma que vira prefixo de id.

    Copia deliberada de `graphify.extractors.base._file_stem`, que e interno ao
    pacote. A funcao `conferir_receita()` abaixo compara o resultado com o id
    canonico conhecido a cada execucao: se a receita mudar la em cima, este
    script para com erro em vez de gravar id errado calado.
    """
    return caminho.with_suffix("").as_posix() if caminho.name else ""


def id_de_arquivo(caminho: Path) -> str:
    return make_id(raiz_do_stem(caminho))


def conferir_receita() -> None:
    esperado = {
        "src/lib/protecao.js": "src_lib_protecao",
        "src/components/AppIcon.jsx": "src_components_appicon",
        "package.json": "package",
    }
    for rel, alvo in esperado.items():
        obtido = id_de_arquivo(Path(rel))
        if obtido != alvo:
            print(
                "Erro: a receita de identificador do graphify mudou.\n"
                f"  para {rel} eu esperava `{alvo}` e obtive `{obtido}`.\n"
                "Nao vou reescrever nada. Confira `graphify/ids.py` e\n"
                "`graphify/extractors/base.py` no pacote instalado antes de seguir.",
                file=sys.stderr,
            )
            raise SystemExit(2)


def corpus_do_detect(raiz: Path) -> list[str]:
    detect = raiz / "graphify-out" / ".graphify_detect.json"
    if not detect.exists():
        print(
            f"Erro: nao encontrei {detect}.\n"
            "Este script roda depois do passo de deteccao do graphify.",
            file=sys.stderr,
        )
        raise SystemExit(2)
    dados = json.loads(detect.read_text(encoding="utf-8"))
    arquivos: list[str] = []
    # `all_files` e o corpus inteiro; `files` e so o que mudou. A uniao cobre os
    # dois formatos (build completo grava so `files`).
    for chave in ("all_files", "files"):
        for lista in dados.get(chave, {}).values():
            arquivos.extend(lista)
    return arquivos


def montar_mapa(raiz: Path, arquivos: list[str]) -> tuple[dict[str, str], list[tuple[str, str]]]:
    """Devolve (troca exata de id, lista de prefixos ordenada do maior ao menor).

    Para cada arquivo do corpus registra as duas formas que o extrator pode ter
    usado — o caminho como veio e o caminho resolvido — nas duas versoes: com
    extensao (id do no do arquivo) e sem extensao (prefixo dos simbolos).
    """
    exatos: dict[str, str] = {}
    prefixos: dict[str, str] = {}
    for bruto in arquivos:
        caminho = Path(bruto)
        try:
            rel = caminho.resolve().relative_to(raiz)
        except (ValueError, OSError):
            continue  # fora da raiz: nao e nosso para renomear
        canonico = id_de_arquivo(rel)
        for forma in (caminho, caminho.resolve()):
            com_extensao = make_id(str(forma))
            if com_extensao != canonico:
                exatos[com_extensao] = canonico
            sem_extensao = id_de_arquivo(forma)
            if sem_extensao != canonico:
                prefixos[sem_extensao] = canonico
    # Maior primeiro: a forma absoluta e a mais longa e nao pode ser encoberta
    # por um prefixo mais curto que tambem casa.
    ordenados = sorted(prefixos.items(), key=lambda kv: len(kv[0]), reverse=True)
    return exatos, ordenados


def normalizar(ident: str, exatos: dict[str, str], prefixos: list[tuple[str, str]]) -> str:
    trocado = exatos.get(ident)
    if trocado is not None:
        return trocado
    for antigo, novo in prefixos:
        if ident.startswith(antigo + "_"):
            return novo + ident[len(antigo):]
    return ident


def main() -> int:
    p = argparse.ArgumentParser(
        description="Tira o caminho da maquina de dentro dos identificadores do grafo."
    )
    modo = p.add_mutually_exclusive_group(required=True)
    modo.add_argument("--verificar", action="store_true",
                      help="so mede; devolve 1 se ainda houver caminho de maquina num id")
    modo.add_argument("--corrigir", action="store_true",
                      help="reescreve o arquivo com os ids canonicos")
    p.add_argument("--raiz", default=".", help="raiz do repositorio (padrao: pasta atual)")
    p.add_argument("arquivos", nargs="+",
                   help="extracoes do graphify (.graphify_ast.json, .graphify_extract.json, ...)")
    args = p.parse_args()

    conferir_receita()
    raiz = Path(args.raiz).resolve()
    exatos, prefixos = montar_mapa(raiz, corpus_do_detect(raiz))
    if not exatos and not prefixos:
        print("Nada a mapear: nenhum arquivo do corpus caiu dentro da raiz.", file=sys.stderr)
        return 2

    problemas = 0
    for nome in args.arquivos:
        alvo = Path(nome)
        if not alvo.exists():
            print(f"Erro: nao encontrei {alvo}.", file=sys.stderr)
            return 2
        dados = json.loads(alvo.read_text(encoding="utf-8"))
        nos_trocados = 0
        pontas_trocadas = 0
        for no in dados.get("nodes", []):
            novo = normalizar(no["id"], exatos, prefixos)
            if novo != no["id"]:
                nos_trocados += 1
                if args.corrigir:
                    no["id"] = novo
        for aresta in dados.get("edges", []):
            for lado in ("source", "target"):
                novo = normalizar(aresta[lado], exatos, prefixos)
                if novo != aresta[lado]:
                    pontas_trocadas += 1
                    if args.corrigir:
                        aresta[lado] = novo
        problemas += nos_trocados + pontas_trocadas
        if args.corrigir:
            alvo.write_text(json.dumps(dados, ensure_ascii=False), encoding="utf-8")
            print(f"{alvo}: {nos_trocados} nos e {pontas_trocadas} pontas de aresta "
                  f"passaram a apontar para o id canonico.")
        else:
            print(f"{alvo}: {nos_trocados} nos e {pontas_trocadas} pontas de aresta "
                  f"ainda carregam o caminho da maquina no identificador.")

    if args.verificar and problemas:
        print(
            f"\nFALHOU: {problemas} identificador(es) com o caminho da maquina colado.\n"
            "Cada ponta de aresta nessa forma aponta para um no que ninguem criou,\n"
            "e a montagem do grafo descarta a aresta sem avisar. Rode de novo com\n"
            "--corrigir antes da juncao.",
            file=sys.stderr,
        )
        return 1
    if args.verificar:
        print("\nOK: nenhum identificador com caminho de maquina.")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())

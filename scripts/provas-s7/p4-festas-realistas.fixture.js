// Duas festas com a forma que o app grava hoje (ids fixos, gerados de novoEvento
// em 06/10/2026). NENHUM preço é zero escrito como texto: é o caso "backup
// antigo sem esses casos" da prova P4 — tem de importar igual ao de antes.
export const FESTAS_REALISTAS = [
  {
    "id": "a-1",
    "nome": "Marfim Alto — edição de março",
    "data": "2027-03-14",
    "local": "Casa das Marfim",
    "publicoEstimado": "",
    "criadoEm": "2026-10-06T20:33:57.399Z",
    "atualizadoEm": "2026-10-06T20:33:57.399Z",
    "taxaBilheteria": 10,
    "cashbackPct": 5,
    "contingenciaPct": 5,
    "outrasReceitas": {
      "bar": "",
      "patrocinio": ""
    },
    "openBar": false,
    "barModo": "porPessoa",
    "barTicket": {
      "pessimista": 70,
      "realista": 85,
      "otimista": 95
    },
    "barTaxaSistemaPct": "",
    "barCustoSistema": "",
    "patrocinios": [],
    "itensDispensados": [],
    "receitaRealizada": {
      "bilheteria": "",
      "bar": ""
    },
    "status": "aberto",
    "fechamento": null,
    "financeiro": null,
    "ritmoTiqueteira": null,
    "tipo": "",
    "descontoMedioPct": "",
    "descontoIngressosModo": "",
    "descontoIngressosValor": "",
    "taxaPagaPor": "",
    "impostoPct": "",
    "impostoSobre": {
      "bilheteria": false,
      "bar": false,
      "patrocinio": false
    },
    "curvaModo": "",
    "curvaRef": {
      "modo": "",
      "itens": []
    },
    "caixaInicial": "",
    "inicioVendas": "",
    "vendasAbremDiasAntes": "",
    "lotes": [
      {
        "id": "a-2",
        "nome": "Lote 1",
        "valor": 120,
        "quantidade": 300,
        "somenteOtimista": false,
        "viradaPrevista": ""
      },
      {
        "id": "a-3",
        "nome": "Lote 2",
        "valor": "150",
        "quantidade": "250",
        "somenteOtimista": false,
        "viradaPrevista": ""
      },
      {
        "id": "a-4",
        "nome": "Cortesias",
        "valor": 0,
        "quantidade": 40,
        "somenteOtimista": false,
        "viradaPrevista": ""
      },
      {
        "id": "a-5",
        "nome": "Porta",
        "valor": 180,
        "quantidade": 80,
        "somenteOtimista": true,
        "viradaPrevista": ""
      },
      {
        "id": "a-6",
        "nome": "Camarote (a definir)",
        "valor": "",
        "quantidade": 60,
        "somenteOtimista": false,
        "viradaPrevista": ""
      }
    ],
    "categorias": [
      {
        "id": "a-7",
        "nome": "A&B",
        "padrao": true,
        "itens": [
          {
            "id": "a-8",
            "servico": "Bar",
            "fornecedor": "",
            "estimado": 18000,
            "realizado": "",
            "status": "ESTIMADO",
            "responsavel": "",
            "obs": "",
            "dataPgto": "",
            "pagamento": "",
            "custouZero": false,
            "realizadoAuto": false,
            "dataPagamento": "",
            "parcelas": [],
            "observacao": "",
            "contato": "",
            "linkOrcamento": ""
          },
          {
            "id": "a-9",
            "servico": "Marfim",
            "fornecedor": "",
            "estimado": "9500",
            "realizado": 9800,
            "status": "ESTIMADO",
            "responsavel": "",
            "obs": "",
            "dataPgto": "",
            "pagamento": "",
            "custouZero": false,
            "realizadoAuto": false,
            "dataPagamento": "",
            "parcelas": [],
            "observacao": "",
            "contato": "",
            "linkOrcamento": ""
          }
        ]
      },
      {
        "id": "a-10",
        "nome": "Locação & Documentação",
        "padrao": true,
        "itens": []
      },
      {
        "id": "a-11",
        "nome": "Estrutura & Cenografia",
        "padrao": true,
        "itens": [
          {
            "id": "a-12",
            "servico": "Som e luz",
            "fornecedor": "",
            "estimado": 12000,
            "realizado": "",
            "status": "ESTIMADO",
            "responsavel": "",
            "obs": "",
            "dataPgto": "",
            "pagamento": "",
            "custouZero": false,
            "realizadoAuto": false,
            "dataPagamento": "",
            "parcelas": [],
            "observacao": "",
            "contato": "",
            "linkOrcamento": ""
          }
        ]
      },
      {
        "id": "a-13",
        "nome": "Equipe",
        "padrao": true,
        "itens": []
      },
      {
        "id": "a-14",
        "nome": "Artístico",
        "padrao": true,
        "itens": []
      },
      {
        "id": "a-15",
        "nome": "Marketing",
        "padrao": true,
        "itens": []
      },
      {
        "id": "a-16",
        "nome": "Extras & Contingência",
        "padrao": true,
        "itens": []
      }
    ],
    "cenariosConfig": {
      "pessimista": {
        "vendaPct": 80,
        "custoPct": 10
      },
      "realista": {
        "vendaPct": 90,
        "custoPct": 0
      },
      "otimista": {
        "vendaPct": 100,
        "custoPct": -5
      },
      "overrides": {
        "pessimista": {},
        "realista": {},
        "otimista": {}
      }
    },
    "padraoPessimista80": {
      "de": null
    },
    "benchmarksAtivos": [
      "bm-cordel",
      "bm-brisa-1205",
      "bm-marfim-0905",
      "bm-brisa-1403"
    ],
    "vendidosAteHoje": 210
  },
  {
    "id": "b-17",
    "nome": "Brisa — fim de ano",
    "data": "2026-12-05",
    "local": "",
    "publicoEstimado": "",
    "criadoEm": "2026-10-06T20:33:57.404Z",
    "atualizadoEm": "2026-10-06T20:33:57.404Z",
    "taxaBilheteria": 10,
    "cashbackPct": 5,
    "contingenciaPct": 8,
    "outrasReceitas": {
      "bar": "",
      "patrocinio": ""
    },
    "openBar": false,
    "barModo": "porPessoa",
    "barTicket": {
      "pessimista": "",
      "realista": "",
      "otimista": ""
    },
    "barTaxaSistemaPct": "",
    "barCustoSistema": "",
    "patrocinios": [],
    "itensDispensados": [],
    "receitaRealizada": {
      "bilheteria": "",
      "bar": ""
    },
    "status": "aberto",
    "fechamento": null,
    "financeiro": null,
    "ritmoTiqueteira": null,
    "tipo": "",
    "descontoMedioPct": 5,
    "descontoIngressosModo": "",
    "descontoIngressosValor": "",
    "taxaPagaPor": "",
    "impostoPct": "",
    "impostoSobre": {
      "bilheteria": false,
      "bar": false,
      "patrocinio": false
    },
    "curvaModo": "",
    "curvaRef": {
      "modo": "",
      "itens": []
    },
    "caixaInicial": "",
    "inicioVendas": "",
    "vendasAbremDiasAntes": "",
    "lotes": [
      {
        "id": "b-18",
        "nome": "Antecipado",
        "valor": 60,
        "quantidade": 500,
        "somenteOtimista": false,
        "viradaPrevista": ""
      },
      {
        "id": "b-19",
        "nome": "Promo",
        "valor": 45.5,
        "quantidade": 120,
        "somenteOtimista": false,
        "viradaPrevista": ""
      },
      {
        "id": "b-20",
        "nome": "Sem preço ainda",
        "valor": null,
        "quantidade": 100,
        "somenteOtimista": false,
        "viradaPrevista": ""
      }
    ],
    "categorias": [
      {
        "id": "b-21",
        "nome": "A&B",
        "padrao": true,
        "itens": []
      },
      {
        "id": "b-22",
        "nome": "Locação & Documentação",
        "padrao": true,
        "itens": []
      },
      {
        "id": "b-23",
        "nome": "Estrutura & Cenografia",
        "padrao": true,
        "itens": []
      },
      {
        "id": "b-24",
        "nome": "Equipe",
        "padrao": true,
        "itens": []
      },
      {
        "id": "b-25",
        "nome": "Artístico",
        "padrao": true,
        "itens": []
      },
      {
        "id": "b-26",
        "nome": "Marketing",
        "padrao": true,
        "itens": []
      },
      {
        "id": "b-27",
        "nome": "Extras & Contingência",
        "padrao": true,
        "itens": []
      }
    ],
    "cenariosConfig": {
      "pessimista": {
        "vendaPct": 80,
        "custoPct": 10
      },
      "realista": {
        "vendaPct": 90,
        "custoPct": 0
      },
      "otimista": {
        "vendaPct": 100,
        "custoPct": -5
      },
      "overrides": {
        "pessimista": {},
        "realista": {},
        "otimista": {}
      }
    },
    "padraoPessimista80": {
      "de": null
    },
    "benchmarksAtivos": [
      "bm-cordel",
      "bm-brisa-1205",
      "bm-marfim-0905",
      "bm-brisa-1403"
    ]
  }
]


# fintrack-export Specification

## Purpose
Permite ao usuário levar seus dados e análises para fora do sistema, gerando relatórios portáteis em PDF e planilha Excel com os mesmos filtros do dashboard para prestação de contas e arquivo.

## Requirements

### Requirement: Exportar relatório filtrado para PDF e XLSX
O sistema SHALL gerar export via GET /reports/export?format=pdf|xlsx&from&to&categoryId&accountId, retornando arquivo binário com Content-Disposition attachment e nomeando com período, respeitando isolamento por usuário.

#### Scenario: Export PDF com filtros
- **WHEN** usuário autenticado envia GET /reports/export?format=pdf&from=2026-08-01&to=2026-08-31
- **THEN** sistema retorna 200 com Content-Type application/pdf, Content-Disposition attachment; filename fintrack-2026-08-01_2026-08-31.pdf e body binário contendo tabela de transações do período do usuário

#### Scenario: Export XLSX com dados espelhados
- **WHEN** usuário envia GET /reports/export?format=xlsx&from=2026-08-01&to=2026-08-31&categoryId=xxx
- **THEN** sistema retorna 200 com Content-Type application/vnd.openxmlformats-officedocument.spreadsheetml.sheet e planilha com abas/colunas (Data, Descrição, Conta, Categoria, Tipo, Valor) filtradas igualmente; se nenhuma transação, planilha contém apenas cabeçalho

#### Scenario: Formato inválido é rejeitado
- **WHEN** cliente envia format=csv
- **THEN** sistema retorna 400 com mensagem de formato suportado

### Requirement: Performance e limites de export
O sistema SHALL limitar export a intervalo máximo de 12 meses, validar from <= to, e streamar resposta para não carregar todo arquivo em memória, retornando 413 se exceder limite configurado.

#### Scenario: Intervalo muito grande é bloqueado
- **WHEN** cliente envia from=2025-01-01&to=2026-12-31 (23 meses)
- **THEN** sistema retorna 400 com erro de intervalo máximo excedido antes de gerar arquivo

#### Scenario: Export com dataset grande usa stream
- **WHEN** usuário exporta período com >5k transações
- **THEN** sistema responde com Transfer-Encoding chunked/stream, sem alocar buffer completo em heap, e completa com 200 dentro de timeout configurado

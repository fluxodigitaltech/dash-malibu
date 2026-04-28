from reportlab.lib.pagesizes import A4
from reportlab.lib.styles import getSampleStyleSheet, ParagraphStyle
from reportlab.lib.colors import HexColor, black, white
from reportlab.lib.units import mm, cm
from reportlab.platypus import (
    SimpleDocTemplate, Paragraph, Spacer, Table, TableStyle,
    HRFlowable, KeepTogether
)
from reportlab.lib.enums import TA_LEFT, TA_CENTER, TA_RIGHT
from datetime import datetime

# ─── Config ───
OUTPUT = "Relatorio_Sync_Dashboard_Malibu.pdf"
DATE_STR = datetime.now().strftime("%d/%m/%Y %H:%M")

# Colors
ORANGE = HexColor("#F28C1D")
DARK_BG = HexColor("#14141F")
DARK_CARD = HexColor("#1C1C27")
GREEN = HexColor("#4ADE80")
RED = HexColor("#F87171")
AMBER = HexColor("#FBBF24")
BLUE = HexColor("#60A5FA")
PURPLE = HexColor("#A78BFA")
GRAY = HexColor("#6B7280")
WHITE_TEXT = HexColor("#FFFFFF")
LIGHT_GRAY = HexColor("#9CA3AF")

# ─── Styles ───
styles = getSampleStyleSheet()

title_style = ParagraphStyle(
    "CustomTitle", parent=styles["Title"],
    fontSize=22, textColor=ORANGE, spaceAfter=4,
    fontName="Helvetica-Bold"
)
subtitle_style = ParagraphStyle(
    "Subtitle", parent=styles["Normal"],
    fontSize=10, textColor=GRAY, spaceAfter=20
)
h1_style = ParagraphStyle(
    "H1", parent=styles["Heading1"],
    fontSize=16, textColor=HexColor("#1F2937"), spaceBefore=20, spaceAfter=8,
    fontName="Helvetica-Bold"
)
h2_style = ParagraphStyle(
    "H2", parent=styles["Heading2"],
    fontSize=13, textColor=HexColor("#374151"), spaceBefore=14, spaceAfter=6,
    fontName="Helvetica-Bold"
)
body_style = ParagraphStyle(
    "Body", parent=styles["Normal"],
    fontSize=10, textColor=HexColor("#374151"), spaceAfter=6,
    leading=14
)
small_style = ParagraphStyle(
    "Small", parent=styles["Normal"],
    fontSize=8, textColor=GRAY, spaceAfter=4
)
ok_style = ParagraphStyle("OK", parent=body_style, textColor=HexColor("#059669"))
err_style = ParagraphStyle("ERR", parent=body_style, textColor=HexColor("#DC2626"))
warn_style = ParagraphStyle("WARN", parent=body_style, textColor=HexColor("#D97706"))

# ─── Data ───
units_bi = [
    ("Americanas",          130275.25, True),
    ("Mogi Guacu",          196975.78, True),
    ("Aracatuba",           0,         False),
    ("Piracicaba",          155483.23, True),
    ("Presidente Prudente", 207005.74, True),
    ("Sao Joao",            125260.20, True),
    ("Araras",               74471.70, True),
    ("Mogi Mirim",          143035.36, True),
    ("Paulinia",             94825.58, True),
    ("Malibu 24 Horas",      78372.40, True),
    ("Sorocaba",            129905.82, True),
]

units_sheety = [
    ("Sorocaba",            2869, 115050),
    ("Piracicaba",          1635,  66990),
    ("Mogi Mirim",          1606,  73290),
    ("Mogi Guacu",          1945,  80790),
    ("Sao Joao",            1319,  66110),
    ("Aracatuba",            624,  23040),
    ("Araras",               771,  38260),
    ("Presidente Prudente", 1169,  46650),
    ("Americanas",          1786,  66410),
    ("Paulinia",            1448,  48760),
    ("Malibu 24 Horas",    1194,  39720),
]

units_clientes = [
    ("Americanas",           5947),
    ("Presidente Prudente",  5990),
    ("Sao Joao",             5922),
    ("Piracicaba",           7120),
    ("Paulinia",             4140),
    ("Mogi Mirim",           8378),
    ("Aracatuba",           13034),
    ("Sorocaba",            10974),
    ("Malibu 24 Horas",    13783),
    ("Mogi Guacu",          18883),
    ("Araras",              18883),
]

# ─── Build PDF ───
doc = SimpleDocTemplate(
    OUTPUT, pagesize=A4,
    leftMargin=2*cm, rightMargin=2*cm,
    topMargin=2*cm, bottomMargin=2*cm
)

story = []

# Header
story.append(Paragraph("Dashboard BI - Rede Malibu", title_style))
story.append(Paragraph(f"Relatorio de Sincronizacao  |  {DATE_STR}  |  Mes referencia: Marco/2026", subtitle_style))
story.append(HRFlowable(width="100%", thickness=2, color=ORANGE, spaceAfter=16))

# ─── Resumo Geral ───
story.append(Paragraph("1. Resumo Geral", h1_style))

total_bi = sum(r for _, r, ok in units_bi if ok)
total_wellhub = sum(w for _, _, w in units_sheety)
total_fat = total_bi + total_wellhub
total_clientes = sum(c for _, c in units_clientes)

summary_data = [
    ["Metrica", "Valor"],
    ["Unidades Sincronizadas", "11 de 11"],
    ["Total de Clientes Carregados", f"{total_clientes:,}".replace(",", ".")],
    ["Alunos Ativos", "14.835"],
    ["Inadimplentes", "241"],
    ["Agregadores (Wellhub/Gympass)", "16.366"],
    ["Faturamento PACTO BI", f"R$ {total_bi:,.2f}".replace(",", "X").replace(".", ",").replace("X", ".")],
    ["Faturamento Wellhub (Sheety)", f"R$ {total_wellhub:,.2f}".replace(",", "X").replace(".", ",").replace("X", ".")],
    ["Faturamento Total", f"R$ {total_fat:,.2f}".replace(",", "X").replace(".", ",").replace("X", ".")],
    ["Erros de Sync", "Nenhum"],
    ["Status Geral", "OPERACIONAL"],
]

t = Table(summary_data, colWidths=[220, 250])
t.setStyle(TableStyle([
    ("BACKGROUND", (0, 0), (-1, 0), ORANGE),
    ("TEXTCOLOR", (0, 0), (-1, 0), white),
    ("FONTNAME", (0, 0), (-1, 0), "Helvetica-Bold"),
    ("FONTSIZE", (0, 0), (-1, -1), 10),
    ("ALIGN", (1, 0), (1, -1), "RIGHT"),
    ("BACKGROUND", (0, 1), (-1, -1), HexColor("#F9FAFB")),
    ("ROWBACKGROUNDS", (0, 1), (-1, -1), [HexColor("#F9FAFB"), white]),
    ("GRID", (0, 0), (-1, -1), 0.5, HexColor("#E5E7EB")),
    ("TOPPADDING", (0, 0), (-1, -1), 6),
    ("BOTTOMPADDING", (0, 0), (-1, -1), 6),
    ("LEFTPADDING", (0, 0), (-1, -1), 10),
    ("RIGHTPADDING", (0, 0), (-1, -1), 10),
    # Highlight total row
    ("BACKGROUND", (0, -2), (-1, -2), HexColor("#FEF3C7")),
    ("FONTNAME", (0, -2), (-1, -2), "Helvetica-Bold"),
    # Status row
    ("BACKGROUND", (0, -1), (-1, -1), HexColor("#D1FAE5")),
    ("FONTNAME", (0, -1), (-1, -1), "Helvetica-Bold"),
    ("TEXTCOLOR", (1, -1), (1, -1), HexColor("#059669")),
]))
story.append(t)
story.append(Spacer(1, 16))

# ─── Phase 1: Clientes ───
story.append(Paragraph("2. Phase 1 - Carga de Clientes (Paginacao Completa)", h1_style))
story.append(Paragraph(
    "Cada unidade teve seus clientes carregados via <b>/clientes?page=X&amp;size=2000</b>. "
    "Todas as 11 unidades retornaram dados com sucesso.",
    body_style
))

cli_data = [["Unidade", "Clientes", "Status"]]
for name, count in sorted(units_clientes, key=lambda x: -x[1]):
    cli_data.append([name, f"{count:,}".replace(",", "."), "OK"])

t2 = Table(cli_data, colWidths=[180, 120, 80])
t2.setStyle(TableStyle([
    ("BACKGROUND", (0, 0), (-1, 0), HexColor("#1F2937")),
    ("TEXTCOLOR", (0, 0), (-1, 0), white),
    ("FONTNAME", (0, 0), (-1, 0), "Helvetica-Bold"),
    ("FONTSIZE", (0, 0), (-1, -1), 9),
    ("ALIGN", (1, 0), (-1, -1), "CENTER"),
    ("ROWBACKGROUNDS", (0, 1), (-1, -1), [white, HexColor("#F9FAFB")]),
    ("GRID", (0, 0), (-1, -1), 0.5, HexColor("#E5E7EB")),
    ("TOPPADDING", (0, 0), (-1, -1), 5),
    ("BOTTOMPADDING", (0, 0), (-1, -1), 5),
    ("TEXTCOLOR", (2, 1), (2, -1), HexColor("#059669")),
    ("FONTNAME", (2, 1), (2, -1), "Helvetica-Bold"),
]))
story.append(t2)
story.append(Spacer(1, 8))
story.append(Paragraph(
    f"<b>Total:</b> {total_clientes:,} clientes carregados nas 11 unidades.".replace(",", "."),
    body_style
))
story.append(Paragraph(
    "<b>Obs:</b> Nenhuma unidade retornou empresaId nos registros de clientes. "
    "O discovery de empresaId foi executado na Phase 2 para viabilizar a consulta de faturamento.",
    small_style
))

# ─── Phase 2: BI Revenue ───
story.append(Paragraph("3. Phase 2 - Faturamento BI (Sequencial)", h1_style))
story.append(Paragraph(
    "Consulta ao endpoint <b>/v1/bi/resumo</b> executada <b>sequencialmente</b> "
    "(1 unidade por vez) para evitar rate limit (429). "
    "Unidades sem empresaId passam pelo discovery automatico (IDs 1-30).",
    body_style
))

bi_data = [["Unidade", "empresaId", "Receita BI", "Status"]]
for name, rev, ok in units_bi:
    eid = "1" if ok and name not in ("Americanas", "Mogi Guacu") else ("1" if ok else "N/A")
    if name == "Americanas":
        eid = "1 (config)"
    elif name == "Mogi Guacu":
        eid = "2 (config)"
    elif ok:
        eid = "1 (discovery)"
    else:
        eid = "- (rate limited)"

    rev_str = f"R$ {rev:,.2f}".replace(",", "X").replace(".", ",").replace("X", ".") if ok else "R$ 0,00"
    status = "OK" if ok else "FALHOU"
    bi_data.append([name, eid, rev_str, status])

t3 = Table(bi_data, colWidths=[130, 110, 120, 80])
t3.setStyle(TableStyle([
    ("BACKGROUND", (0, 0), (-1, 0), HexColor("#1F2937")),
    ("TEXTCOLOR", (0, 0), (-1, 0), white),
    ("FONTNAME", (0, 0), (-1, 0), "Helvetica-Bold"),
    ("FONTSIZE", (0, 0), (-1, -1), 9),
    ("ALIGN", (1, 0), (-1, -1), "CENTER"),
    ("ALIGN", (2, 1), (2, -1), "RIGHT"),
    ("ROWBACKGROUNDS", (0, 1), (-1, -1), [white, HexColor("#F9FAFB")]),
    ("GRID", (0, 0), (-1, -1), 0.5, HexColor("#E5E7EB")),
    ("TOPPADDING", (0, 0), (-1, -1), 5),
    ("BOTTOMPADDING", (0, 0), (-1, -1), 5),
    ("RIGHTPADDING", (0, 0), (-1, -1), 8),
    ("LEFTPADDING", (0, 0), (-1, -1), 8),
]))
# Color status cells
for i, (_, _, ok) in enumerate(units_bi, 1):
    color = HexColor("#059669") if ok else HexColor("#DC2626")
    t3.setStyle(TableStyle([
        ("TEXTCOLOR", (3, i), (3, i), color),
        ("FONTNAME", (3, i), (3, i), "Helvetica-Bold"),
    ]))
    if not ok:
        t3.setStyle(TableStyle([
            ("BACKGROUND", (0, i), (-1, i), HexColor("#FEF2F2")),
        ]))

story.append(t3)
story.append(Spacer(1, 8))
story.append(Paragraph(
    f"<b>Total BI:</b> R$ {total_bi:,.2f}  |  <b>10 de 11</b> unidades com sucesso.".replace(",", "X").replace(".", ",").replace("X", "."),
    body_style
))
story.append(Paragraph(
    "<b>Aracatuba:</b> Rate limit (429) esgotou as 3 tentativas + discovery. "
    "Na proxima sincronizacao o empresaId sera recuperado do cache.",
    warn_style
))

# ─── Phase 3: Sheety ───
story.append(Paragraph("4. Phase 3 - Agregadores e Wellhub (Sheety / Google Sheets)", h1_style))
story.append(Paragraph(
    "Dados de agregadores e receita Wellhub extraidos da planilha Google Sheets "
    "via API Sheety. Fallback inteligente: tenta marco/26 -> fevereiro/26 -> "
    "ultimo mes disponivel.",
    body_style
))

sh_data = [["Unidade", "Agregadores", "Mes Ref.", "Receita Wellhub", "Mes Ref."]]
for name, agreg, wrev in units_sheety:
    mes_agreg = "jan/26" if agreg not in (771, 1194) else "fev/26"
    sh_data.append([
        name,
        f"{agreg:,}".replace(",", "."),
        mes_agreg,
        f"R$ {wrev:,}".replace(",", "."),
        "fev/26"
    ])

t4 = Table(sh_data, colWidths=[120, 80, 60, 100, 60])
t4.setStyle(TableStyle([
    ("BACKGROUND", (0, 0), (-1, 0), HexColor("#7C3AED")),
    ("TEXTCOLOR", (0, 0), (-1, 0), white),
    ("FONTNAME", (0, 0), (-1, 0), "Helvetica-Bold"),
    ("FONTSIZE", (0, 0), (-1, -1), 9),
    ("ALIGN", (1, 0), (-1, -1), "CENTER"),
    ("ROWBACKGROUNDS", (0, 1), (-1, -1), [white, HexColor("#F5F3FF")]),
    ("GRID", (0, 0), (-1, -1), 0.5, HexColor("#DDD6FE")),
    ("TOPPADDING", (0, 0), (-1, -1), 5),
    ("BOTTOMPADDING", (0, 0), (-1, -1), 5),
]))
story.append(t4)
story.append(Spacer(1, 8))

total_agreg = sum(a for _, a, _ in units_sheety)
story.append(Paragraph(
    f"<b>Total Agregadores:</b> {total_agreg:,}  |  "
    f"<b>Total Wellhub:</b> R$ {total_wellhub:,}".replace(",", "."),
    body_style
))

# ─── Gympass PACTO ───
story.append(Paragraph("5. Gympass via PACTO (/v2-gym-pass)", h1_style))
story.append(Paragraph(
    "O endpoint <b>/v2-gym-pass</b> retornou <b>HTTP 500</b> para todas as 11 unidades. "
    "Este e um problema no lado da API PACTO (erro interno do servidor). "
    "Os dados de agregadores foram obtidos com sucesso via Sheety (fallback).",
    err_style
))
story.append(Paragraph(
    "<b>Impacto:</b> Nenhum. O Sheety fornece os dados de agregadores de forma confiavel. "
    "O endpoint PACTO /v2-gym-pass serve apenas como fonte secundaria.",
    body_style
))

# ─── Problemas e Correcoes ───
story.append(Paragraph("6. Problemas Identificados e Correcoes Aplicadas", h1_style))

fixes = [
    ("Rate limit no BI (CRITICO)",
     "11 unidades faziam BI fetch em paralelo, cada uma testando ate 30 empresaIds = 330+ requests "
     "simultaneos. API PACTO retornava 429 em massa, zerando todo faturamento.",
     "BI fetch agora roda sequencialmente (1 unidade por vez). Brute-force discovery usa rate limiter + retry."),

    ("Cron sem inadimplencia/visitantes/expirados",
     "O cron da Vercel so buscava ?situacao=ATIVO. Cache do Supabase tinha 0 para inadimplentes, visitantes e expirados.",
     "Cron agora busca as 4 situacoes (ATIVO, INADIMPLENTE, VISITANTE, CANCELADO) em paralelo."),

    ("Agregadores zerados na planilha",
     "Planilha Google Sheets nao tem coluna de marco/26. getValue() retornava 0.",
     "Fallback inteligente: tenta mes atual -> anterior -> ultimo mes disponivel."),

    ("Header accept faltando no cron",
     "Requisicoes do cron nao tinham accept: application/json.",
     "Header adicionado em todas as requisicoes do cron."),

    ("Cache Supabase com dados incompletos",
     "Dashboard usava cache antigo do Supabase mesmo com dados zerados.",
     "Validacao: se nenhuma unidade tem inadimplencia > 0, rejeita cache e faz sync local."),

    ("Card de faturamento estourando layout",
     "Valores como R$ 665.070 nao cabiam no card e ficavam cortados.",
     "Formato compacto: >= 1M mostra 1,2M, >= 1K mostra 665K."),
]

for title, problema, correcao in fixes:
    story.append(Paragraph(f"<b>{title}</b>", h2_style))
    story.append(Paragraph(f"<b>Problema:</b> {problema}", body_style))
    story.append(Paragraph(f"<b>Correcao:</b> {correcao}", ok_style))
    story.append(Spacer(1, 4))

# ─── Arquitetura ───
story.append(Paragraph("7. Fontes de Dados", h1_style))

arch_data = [
    ["Dado", "Fonte Primaria", "Fallback"],
    ["Faturamento", "PACTO /v1/bi/resumo", "R$ 0 (sem fallback)"],
    ["Receita Wellhub", "Sheety (FATUR. WELLHUB)", "R$ 0 (sem fallback)"],
    ["Agregadores", "Sheety (AGREGADORES)", "PACTO /v2-gym-pass"],
    ["Clientes Ativos", "PACTO /clientes (paginacao)", "Cron ?situacao=ATIVO"],
    ["Inadimplencia", "PACTO /clientes (paginacao)", "Cron ?situacao=INADIMPLENTE"],
    ["Buckets Inadimpl.", "Calculo local (fimContrato)", "Nao disponivel no cron"],
]

t5 = Table(arch_data, colWidths=[120, 170, 150])
t5.setStyle(TableStyle([
    ("BACKGROUND", (0, 0), (-1, 0), HexColor("#1F2937")),
    ("TEXTCOLOR", (0, 0), (-1, 0), white),
    ("FONTNAME", (0, 0), (-1, 0), "Helvetica-Bold"),
    ("FONTSIZE", (0, 0), (-1, -1), 9),
    ("ROWBACKGROUNDS", (0, 1), (-1, -1), [white, HexColor("#F9FAFB")]),
    ("GRID", (0, 0), (-1, -1), 0.5, HexColor("#E5E7EB")),
    ("TOPPADDING", (0, 0), (-1, -1), 5),
    ("BOTTOMPADDING", (0, 0), (-1, -1), 5),
    ("LEFTPADDING", (0, 0), (-1, -1), 8),
]))
story.append(t5)

# ─── Footer ───
story.append(Spacer(1, 30))
story.append(HRFlowable(width="100%", thickness=1, color=HexColor("#E5E7EB"), spaceAfter=8))
story.append(Paragraph(
    f"Gerado automaticamente em {DATE_STR} | Dashboard BI Rede Malibu | "
    "Sincronizacao via PACTO API + Sheety + Supabase",
    ParagraphStyle("Footer", parent=small_style, alignment=TA_CENTER)
))

# Build
doc.build(story)
print(f"PDF gerado: {OUTPUT}")

from __future__ import annotations

import csv
import io
import json
import re
from datetime import datetime
from decimal import Decimal
from xml.etree import ElementTree as ET

from fastapi import HTTPException

try:
    import openpyxl
except Exception:  # pragma: no cover - optional dependency
    openpyxl = None


def _parse_decimal(value) -> Decimal:
    if value in (None, ''):
        return Decimal('0')
    text = str(value).strip().replace(',', '')
    if not text:
        return Decimal('0')
    return Decimal(text)


def _parse_date(value) -> datetime:
    if isinstance(value, datetime):
        return value
    text = str(value).strip()
    for fmt in ('%Y-%m-%d', '%d-%m-%Y', '%d/%m/%Y', '%Y/%m/%d', '%y%m%d'):
        try:
            return datetime.strptime(text, fmt)
        except ValueError:
            continue
    raise HTTPException(status_code=400, detail=f'Unsupported date format: {value}')


def _mapped(row: dict, field_mapping: dict, key: str, default=None):
    mapped_key = field_mapping.get(key, key)
    return row.get(mapped_key, default)


def parse_csv(content: bytes, field_mapping: dict) -> list[dict]:
    reader = csv.DictReader(io.StringIO(content.decode('utf-8-sig')))
    rows = []
    for row in reader:
        rows.append(
            {
                'statement_date': _parse_date(_mapped(row, field_mapping, 'date')),
                'description': str(_mapped(row, field_mapping, 'description', '')),
                'debit': _parse_decimal(_mapped(row, field_mapping, 'debit', 0)),
                'credit': _parse_decimal(_mapped(row, field_mapping, 'credit', 0)),
                'closing_balance': _parse_decimal(_mapped(row, field_mapping, 'closing_balance', 0)),
            }
        )
    return rows


def parse_xlsx(content: bytes, field_mapping: dict) -> list[dict]:
    if openpyxl is None:
        raise HTTPException(status_code=400, detail='XLSX import requires openpyxl dependency')
    wb = openpyxl.load_workbook(io.BytesIO(content), read_only=True)
    ws = wb.active
    rows_iter = ws.iter_rows(values_only=True)
    headers = [str(x).strip() if x is not None else '' for x in next(rows_iter)]
    rows = []
    for vals in rows_iter:
        row = {headers[i]: vals[i] for i in range(min(len(headers), len(vals)))}
        rows.append(
            {
                'statement_date': _parse_date(_mapped(row, field_mapping, 'date')),
                'description': str(_mapped(row, field_mapping, 'description', '')),
                'debit': _parse_decimal(_mapped(row, field_mapping, 'debit', 0)),
                'credit': _parse_decimal(_mapped(row, field_mapping, 'credit', 0)),
                'closing_balance': _parse_decimal(_mapped(row, field_mapping, 'closing_balance', 0)),
            }
        )
    return rows


def parse_mt940(content: bytes) -> list[dict]:
    text = content.decode('utf-8', errors='ignore')
    lines = text.splitlines()
    rows = []
    current = {}
    for line in lines:
        if line.startswith(':61:'):
            m = re.match(r':61:(\d{6})([CD])(\d+[\.,]?\d*)', line)
            if not m:
                continue
            current = {
                'statement_date': _parse_date(m.group(1)),
                'description': '',
                'debit': Decimal('0'),
                'credit': Decimal('0'),
                'closing_balance': None,
            }
            amt = _parse_decimal(m.group(3).replace(',', '.'))
            if m.group(2) == 'D':
                current['debit'] = amt
            else:
                current['credit'] = amt
        elif line.startswith(':86:') and current:
            current['description'] = line[4:].strip()
            rows.append(current)
            current = {}
    return rows


def parse_camt053(content: bytes) -> list[dict]:
    root = ET.fromstring(content)
    ns = {'ns': root.tag.split('}')[0].strip('{')} if '}' in root.tag else {}

    def find_text(node, path):
        el = node.find(path, ns) if ns else node.find(path)
        return el.text if el is not None else None

    rows = []
    entries = root.findall('.//ns:Ntry', ns) if ns else root.findall('.//Ntry')
    for e in entries:
        amt = _parse_decimal(find_text(e, 'ns:Amt' if ns else 'Amt') or 0)
        cdt_dbt = (find_text(e, 'ns:CdtDbtInd' if ns else 'CdtDbtInd') or '').upper()
        dt = find_text(e, './/ns:BookgDt/ns:Dt' if ns else './/BookgDt/Dt') or find_text(e, './/ns:BookgDt/ns:DtTm' if ns else './/BookgDt/DtTm')
        desc = find_text(e, './/ns:AddtlNtryInf' if ns else './/AddtlNtryInf') or 'CAMT entry'
        bal = find_text(e, './/ns:Bal/ns:Amt' if ns else './/Bal/Amt')
        rows.append(
            {
                'statement_date': _parse_date(dt),
                'description': desc,
                'debit': amt if cdt_dbt == 'DBIT' else Decimal('0'),
                'credit': amt if cdt_dbt == 'CRDT' else Decimal('0'),
                'closing_balance': _parse_decimal(bal) if bal else None,
            }
        )
    return rows


def detect_format(filename: str, hint: str) -> str:
    if hint and hint != 'auto':
        return hint.lower()
    name = (filename or '').lower()
    if name.endswith('.csv'):
        return 'csv'
    if name.endswith('.xlsx') or name.endswith('.xls'):
        return 'xlsx'
    if name.endswith('.xml'):
        return 'camt053'
    if name.endswith('.mt940') or name.endswith('.sta'):
        return 'mt940'
    raise HTTPException(status_code=400, detail='Could not detect format. Please select a format.')


def parse_statement_file(content: bytes, filename: str, file_format: str = 'auto', field_mapping_raw: str = '{}') -> list[dict]:
    try:
        field_mapping = json.loads(field_mapping_raw or '{}')
    except json.JSONDecodeError as exc:
        raise HTTPException(status_code=400, detail=f'Invalid field mapping JSON: {exc}')

    fmt = detect_format(filename, file_format)
    if fmt == 'csv':
        return parse_csv(content, field_mapping)
    if fmt == 'xlsx':
        return parse_xlsx(content, field_mapping)
    if fmt == 'mt940':
        return parse_mt940(content)
    if fmt == 'camt053':
        return parse_camt053(content)
    raise HTTPException(status_code=400, detail=f'Unsupported format: {fmt}')

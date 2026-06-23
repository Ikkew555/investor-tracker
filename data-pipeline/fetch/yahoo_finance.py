"""
Yahoo Finance implementation of MarketDataProvider.

Fetch strategy per symbol (3 calls):
  1. v8/chart          → price, open, close, last dividend date/value
  2. v10/quoteSummary  → sector, industry, dividend_rate, dividend_yield
  3. v7/quote          → fills any fields still None after step 2

Each network call tries: query2 → query1 → corsproxy.io (server IPs are often
blocked by Yahoo; the proxy routes through a browser-like origin).

sector/industry from v7 are absent for most ASX stocks — NULL is expected there.
"""

import time
import requests
from datetime import datetime, timezone
from urllib.parse import urlencode, quote as url_quote

from .market_data_provider import MarketDataProvider

# ── constants ──────────────────────────────────────────────────────────────────

_HEADERS = {
    "User-Agent": (
        "Mozilla/5.0 (Windows NT 10.0; Win64; x64) "
        "AppleWebKit/537.36 (KHTML, like Gecko) "
        "Chrome/124.0.0.0 Safari/537.36"
    ),
    "Accept": "application/json",
    "Accept-Language": "en-US,en;q=0.9",
    "Referer": "https://finance.yahoo.com",
}

_EXCHANGE_SUFFIXES: dict[str, str] = {
    "ASX": ".AX", "LSE": ".L",  "TSE": ".T",  "HKEX": ".HK",
    "TSX": ".TO", "FRA": ".F",  "EPA": ".PA", "AMS":  ".AS",
    "SWX": ".SW", "BIT": ".MI", "BME": ".MC",
    "NASDAQ": "", "NYSE": "", "NYSEARCA": "",
}

_V10_MODULES = "assetProfile,defaultKeyStatistics,summaryDetail,price"
_V7_FIELDS   = "trailingAnnualDividendRate,trailingAnnualDividendYield,dividendRate,dividendYield,sector,industry"


# ── helpers ────────────────────────────────────────────────────────────────────

def _proxy(url: str) -> str:
    return f"https://corsproxy.io/?{url_quote(url, safe='')}"


def _get_json(urls: list[str], label: str) -> dict | None:
    """Try each URL in order; return parsed JSON on the first 200 response."""
    for url in urls:
        try:
            resp = requests.get(url, headers=_HEADERS, timeout=30)
            if resp.status_code == 200:
                return resp.json()
            print(f"{label} HTTP {resp.status_code} via {url[:70]}")
        except Exception as e:
            print(f"{label} error via {url[:70]}: {e}")
    print(f"{label} — all attempts failed")
    return None


def _raw(field) -> float | None:
    """Unwrap Yahoo's {raw, fmt} dict or return a plain number as-is."""
    if field is None:
        return None
    if isinstance(field, dict):
        return field.get("raw")
    return float(field) if field != "" else None


def _first(*values):
    """Return the first non-None value (Python equivalent of JS ??-chaining)."""
    return next((v for v in values if v is not None), None)


def _unix_to_date(ts) -> str | None:
    if ts is None:
        return None
    try:
        return datetime.fromtimestamp(int(ts), tz=timezone.utc).strftime("%Y-%m-%d")
    except (ValueError, OSError, OverflowError):
        return None


# ── provider ───────────────────────────────────────────────────────────────────

class YahooFinanceProvider(MarketDataProvider):

    def fetch(self, securities: list[dict]) -> list[dict]:
        rows = []
        for i, sec in enumerate(securities):
            symbol   = sec.get("symbol", "")
            exchange = sec.get("exchange") or ""
            if not symbol:
                continue
            if i > 0:
                time.sleep(0.1)         # avoid Yahoo rate-limiting
            row = self._fetch_symbol(symbol, exchange)
            if row:
                rows.append(row)
        return rows

    # ── call 1 ────────────────────────────────────────────────────────────────

    def _fetch_symbol(self, symbol: str, exchange: str) -> dict | None:
        yahoo_sym = symbol + _EXCHANGE_SUFFIXES.get(exchange.upper(), "")

        params = urlencode({"interval": "1mo", "range": "1y", "events": "div"})
        base   = f"https://query2.finance.yahoo.com/v8/finance/chart/{yahoo_sym}"
        data   = _get_json([f"{base}?{params}"], f"v8 {yahoo_sym}")
        if not data:
            return None

        result = (data.get("chart", {}).get("result") or [None])[0]
        if not result:
            return None

        meta = result.get("meta", {})

        # regularMarketOpen is absent when the market is closed — fall back to
        # the last non-null open from the monthly OHLC candles.
        open_price = meta.get("regularMarketOpen")
        if open_price is None:
            candle_opens = result.get("indicators", {}).get("quote", [{}])[0].get("open") or []
            open_price   = next((x for x in reversed(candle_opens) if x is not None), None)

        last_div_date = last_div_value = None
        dividends = result.get("events", {}).get("dividends", {})
        if dividends:
            latest        = dividends[max(dividends, key=int)]
            last_div_date = _unix_to_date(latest.get("date"))
            last_div_value = latest.get("amount")

        # calls 2 + 3
        summary = self._fetch_summary(yahoo_sym)

        return {
            "symbol":               symbol,
            "exchange":             meta.get("exchangeName"),
            "currency":             meta.get("currency"),
            "regular_market_price": meta.get("regularMarketPrice"),
            "open":                 open_price,
            "close":                meta.get("chartPreviousClose"),
            "dividend_rate":        summary["dividend_rate"],
            "dividend_yield":       summary["dividend_yield"],
            "last_dividend_date":   last_div_date,
            "last_dividend_value":  last_div_value,
            "sector":               summary["sector"],
            "industry":             summary["industry"],
        }

    # ── call 2 ────────────────────────────────────────────────────────────────

    def _fetch_v10(self, yahoo_sym: str) -> dict:
        out    = {"dividend_rate": None, "dividend_yield": None, "sector": None, "industry": None}
        params = urlencode({"modules": _V10_MODULES})
        direct = f"https://query1.finance.yahoo.com/v10/finance/quoteSummary/{yahoo_sym}?{params}"
        urls   = [
            f"https://query2.finance.yahoo.com/v10/finance/quoteSummary/{yahoo_sym}?{params}",
            direct,
            _proxy(direct),
        ]

        data = _get_json(urls, f"v10 {yahoo_sym}")
        if not data:
            return out

        results = (data.get("quoteSummary") or {}).get("result") or []
        if not results:
            print(f"v10 empty result for {yahoo_sym}: {(data.get('quoteSummary') or {}).get('error')}")
            return out

        qt = results[0]
        sd = qt.get("summaryDetail") or {}
        ap = qt.get("assetProfile")  or {}
        pr = qt.get("price")         or {}

        out["dividend_rate"]  = _first(_raw(sd.get("dividendRate")),  _raw(pr.get("trailingAnnualDividendRate")))
        out["dividend_yield"] = _first(_raw(sd.get("dividendYield")), _raw(pr.get("trailingAnnualDividendYield")))
        out["sector"]         = ap.get("sector")   or None
        out["industry"]       = ap.get("industry") or None
        return out

    # ── call 3 ────────────────────────────────────────────────────────────────

    def _fill_from_v7(self, yahoo_sym: str, summary: dict) -> None:
        """Fill any remaining None fields from v7/quote. Mutates summary in place."""
        params = urlencode({"symbols": yahoo_sym, "fields": _V7_FIELDS})
        direct = f"https://query2.finance.yahoo.com/v7/finance/quote?{params}"
        urls   = [
            direct,
            f"https://query1.finance.yahoo.com/v7/finance/quote?{params}",
            _proxy(direct),
        ]

        data = _get_json(urls, f"v7 {yahoo_sym}")
        if not data:
            return

        quotes = (data.get("quoteResponse") or {}).get("result") or []
        if not quotes:
            return

        q = quotes[0]
        if summary["dividend_rate"] is None:
            summary["dividend_rate"]  = _first(_raw(q.get("trailingAnnualDividendRate")), _raw(q.get("dividendRate")))
        if summary["dividend_yield"] is None:
            summary["dividend_yield"] = _first(_raw(q.get("trailingAnnualDividendYield")), _raw(q.get("dividendYield")))
        if summary["sector"] is None:
            summary["sector"]   = q.get("sector")   or None
        if summary["industry"] is None:
            summary["industry"] = q.get("industry") or None

    # ── orchestrate calls 2 + 3 ───────────────────────────────────────────────

    def _fetch_summary(self, yahoo_sym: str) -> dict:
        summary = self._fetch_v10(yahoo_sym)
        if any(summary[k] is None for k in summary):
            self._fill_from_v7(yahoo_sym, summary)
        return summary

import os

from fetch.market_data_provider import MarketDataProvider


def get_price_provider() -> MarketDataProvider:
    """
    Return the configured market data provider.
    To swap providers, set MARKET_DATA_PROVIDER env var or add a new subclass
    of MarketDataProvider and register it here.
    """
    name = os.getenv("MARKET_DATA_PROVIDER", "yahoo_finance")

    if name == "yahoo_finance":
        from fetch.yahoo_finance import YahooFinanceProvider
        return YahooFinanceProvider()

    raise ValueError(f"Unknown market data provider: {name!r}")

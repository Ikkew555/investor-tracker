from abc import ABC, abstractmethod


class MarketDataProvider(ABC):
    """
    Swap to a different market data source by creating a new subclass
    and pointing market_data_dag.py to it — nothing else changes.
    """

    @abstractmethod
    def fetch(self, securities: list[dict]) -> list[dict]:
        """
        Fetch market data for the given securities.

        Each item in `securities` must have at least a "symbol" key and optionally
        an "exchange" key (e.g. "ASX", "NASDAQ") used to build the correct Yahoo suffix.

        Returns a list of dicts whose keys match the raw_market_data table columns:
          symbol, exchange, currency, regular_market_price,
          open, close, dividend_rate, dividend_yield,
          last_dividend_date, last_dividend_value, sector, industry
        """

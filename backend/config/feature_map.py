FEATURE_MAP: dict[str, str] = {
    "performance":              "mart_performance",
    "home_page":                "mart_performance",
    "sold_securities":          "mart_sold_securities",
    "calendar":                 "mart_calendar_events",
    "contribution_analysis":    "mart_contribution_analysis",
    "future_income":            "mart_future_income",
    "multi_currency":           "mart_multi_currency",
    "multi_period":             "mart_multi_period",
    # Tax engine — 4 separate tables
    "tax":                      "mart_tax_summary",
    "tax_cgt_events":           "mart_tax_cgt_events",
    "tax_dividend_events":      "mart_tax_dividend_events",
    "tax_remaining_parcels":    "mart_tax_remaining_parcels",
}

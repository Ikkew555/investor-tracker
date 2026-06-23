User Manual: Portfolio Tracker

Welcome to your Portfolio Tracker! This guide will help you understand how to use the application to manage your investments effectively.

Table of Contents:

    Getting Started

        Creating an Account

        Logging In

    Navigating the Application

    Dashboard / Home Page

        Viewing Transactions

        Adding Transactions Manually

        Importing Transactions via CSV (General)

    Managing Brokers & Importing Data

        Selecting a Broker

        Importing Broker-Specific CSV

    Viewing Holdings

    Analyzing Performance

    Generating Reports

    Managing Settings

        General Settings (Base Currency, Exchange Rates)

        Account Settings

        Contribution Limits

        Investment Goals

        Appearance (Theme)

        Data Export

        Your Profile

    Pricing and Features

    Admin Dashboard (For Administrators)

    Troubleshooting & FAQ

1. Getting Started
Creating an Account

    Open the Portfolio Tracker application in your web browser.

    If you are new, click on the "Sign Up" link, usually found in the header or on the landing page.

    Fill in the required information:

        First Name

        Last Name

        Email Address

        Password

        Confirm Password

    Click the "Sign Up" or "Create Account" button.

    You may need to verify your email address. Check your inbox for a confirmation email and click the link provided.

Logging In

    Open the Portfolio Tracker application.

    Click on the "Login" or "Sign In" link.

    Enter your registered Email Address and Password.

    Click the "Log In" or "Sign In" button.

    Upon successful login, you will be redirected to your dashboard (Home Page).

2. Navigating the Application

The main navigation is located in the header at the top of the page. Key sections include:

    Home: Your main dashboard, showing transactions and import options.

    Brokers: Manage and import data from specific brokers.

    Holdings: View a summary of your current investments.

    Performance: Analyze the performance of your portfolio.

    Pricing: (If available) View subscription plans.

    Features: (If available) Learn about application features.

    Income: (If implemented) Track your investment income.

    Activities: View a log of all your financial activities (transactions, dividends).

    Settings: Configure your application and portfolio preferences.

    Profile Icon (Top Right): Click this to access:

        Your Profile (linked to Settings)

        Admin Dashboard (if you are an admin)

        Sign Out

3. Dashboard / Home Page (HomePage.jsx)

This is your central hub after logging in.
Viewing Transactions

    The main area of the Home page displays a table of your transactions (TransactionTable.jsx).

    You can:

        Filter transactions by type (Buy, Sell, Dividend).

        Paginate through your transactions if you have many.

        Refresh the list to see the latest data.

        Delete individual transactions using the trash icon.

        Delete All your transaction data (use with extreme caution!).

Adding Transactions Manually

    On the Home page, click the "Add Transaction" button.

    A form (AddTransactionForm.jsx) will appear.

    Fill in the details:

        Transaction Type: Buy, Sell, or Dividend.

        Transaction Date: When the transaction occurred.

        Market: The stock exchange (e.g., ASX, NASDAQ).

        Broker (Optional): Select from your saved brokers.

        Security: Start typing the stock code/symbol. If found in the database, it will pre-fill details.

        Security Code: If not found, enter the code manually.

        Security Name (Optional): Name of the security.

        Currency: The currency of the transaction.

        Quantity: Number of shares/units (not applicable for Dividends if it's a cash amount).

        Price: Price per share/unit, or total dividend amount for Dividend type.

        Brokerage Fee: Any fees associated with the transaction (not applicable for Dividends).

        Notes (Optional): Any comments about the transaction.

    Click "Add Transaction" to save. Click "Cancel" to discard.

Importing Transactions via CSV (General) (EnhancedCSVUploader.jsx)

    On the Home page, navigate to the "Import" tab.

    Select CSV Format: Choose the format of your CSV file from the dropdown (e.g., "Sharesight Format", "180 Markets", "HSBC Australia", etc.).

    Upload File:

        Drag and drop your CSV file onto the designated area.

        Or, click "Select File" and choose the CSV file from your computer.

    Preview: A preview of the first few rows of your parsed data will be shown. Verify that the columns seem correct.

    Import: If the preview looks good, click "Import Transactions". The data will be saved to your portfolio.

    If there's an error (e.g., wrong format, missing columns), an error message will appear. You can then "Cancel" and try again.

4. Managing Brokers & Importing Data (Broker.jsx, BrokerUpload.jsx)

This section allows you to import data from specific, supported brokers.

    Navigate to the "Brokers" page from the header.

    You'll see a list or grid of supported brokers (e.g., 180 Markets, HSBC).

    Click on the broker you want to import data from.

    You will be taken to a dedicated upload page for that broker (BrokerUpload.jsx).

    This page uses a CSV uploader (BrokerCSVUploader.jsx) pre-configured for that broker's specific CSV format.

    Upload File:

        Drag and drop your broker's CSV file.

        Or, click "Select File" and choose the file.

    Preview & Import: Similar to the general CSV import, you'll see a preview. Click "Import Transactions" to save.

    The page will also display any existing transactions already imported from this broker. You can delete individual transactions or all data for this specific broker.

5. Viewing Holdings (Holdings.jsx)

    Navigate to the "Holdings" page.

    This page provides a summary of your current investments.

    You'll typically see:

        Charts: Pie charts showing your portfolio allocation by Class, Currency, Country, and Sector.

        Table of Holdings: A list of your current securities, showing symbol, company name, quantity, current price, and total value.
        (Note: Real-time price updates and detailed value calculations depend on backend logic and data sources not fully detailed in the provided files.)

6. Analyzing Performance (Performance.jsx)

    Navigate to the "Performance" page.

    This section helps you track how your investments are doing.

    Time Filter: Select a time range (e.g., last 5 years, last year) to view performance over that period.

    Performance Charts (PerformanceChart.jsx):

        Portfolio Diversification Over Time: Shows how your asset allocation across different markets (ASX, LSE, NASDAQ etc.) has changed.

        Total Portfolio Value Over Time: A line chart tracking the growth of your portfolio's total value.

        Asset Allocation by Sector: A bar chart showing how your investments are distributed across different sectors (Tech, Healthcare, etc.).

        Current Holdings Snapshot: A pie chart showing the current distribution of your holdings.

    Assets Table (AssetsTable.jsx): A table listing your assets with details like price, quantity, value, capital gains, dividends, and return.
    (Note: Accuracy of capital gains, dividends, and return depends on comprehensive transaction data and backend calculations.)

7. Generating Reports (Reports.jsx, ReportRoutes.jsx)

    Navigate to the "Reports" page.

    This page lists various reports you can generate, categorized by Performance, Asset Allocation, and Tax & Compliance.

    Available Reports:

        Sold Securities: Shows capital gains, dividends, and returns for holdings you've sold.

        Future Income: Forecasts upcoming dividend and interest payments.

        Exposure: Shows portfolio exposure to sectors, markets, and asset classes.

        All Trades: Lists all trades over a selected date range.

        Taxable Income: Summarizes dividend and interest payments for tax purposes.

    Click on a report title or "View Report".

    A modal (pop-up window) will appear with a description of the report.

    Click "Run Report" to view the specific report page.

8. Managing Settings (Settings.jsx)

Navigate to the "Settings" page to customize your application and portfolio preferences. The settings are organized into tabs:
General Settings

    Base Currency: Select the main currency for your portfolio display and reporting.

    Exchange Rates:

        View existing custom exchange rates you've set.

        Add new exchange rates: Select a currency, enter its rate relative to your base currency, and click "Add Rate".

        Remove existing rates.

    Click "Save" or "Save Exchange Rates" to apply changes.

Account Settings (PortfolioSettings.jsx)

    View a list of your financial accounts (e.g., brokerage accounts, savings accounts).

    Add Account:

        Click "Add Account".

        Enter Account Name, select Account Group (e.g., Retirement, Personal), select Account Type (e.g., Securities, Cash), and optionally add a Description.

        Click "Add Account".

    Edit Account: Click the pencil icon next to an account to modify its details.

    Delete Account: Click the trash icon to remove an account.

Contribution Limits (LimitsSettings.jsx)

    Manage and track contribution limits for accounts (e.g., RRSP, TFSA limits).

    Add Contribution Limit:

        Click "Add Contribution Limit".

        Enter Group Name (e.g., "TFSA 2024"), Contribution Year, Limit Amount.

        Optionally, assign specific accounts from your "Account Settings" to this limit.

        Click "Add Limit".

    View existing limits, their progress (amount contributed vs. limit), and assigned accounts.

    Edit or delete existing limits.

Investment Goals (GoalsSettings.jsx)

    Set and track your financial goals.

    Add Goal:

        Click "Add Goal".

        Enter Goal Name, select Goal Type (e.g., Retirement, House), Target Amount, and optionally Target Date and Description.

        Click "Add Goal".

    View existing goals, their progress (current amount vs. target amount), and target dates.

    Edit existing goals (you can update the "Current Amount" to track progress).

    Delete goals.

Appearance (ThemeToggle.jsx within Settings.jsx)

    Choose your preferred application theme:

        Light Mode

        Dark Mode

    Use the toggle switch or select a theme preview.

    Click "Save Theme Preferences". Your choice is usually saved automatically.

Data Export (DataExportSettings.jsx)

    Export your portfolio data.

    Select Data to Export: Checkboxes for Accounts, Holdings, Activities, Goals, Portfolio History.

    Select Export Format: Choose from JSON, CSV, or SQL.

    Click "Export Data". The file will be downloaded to your device.

Your Profile

    View your account email.

    May provide a link to manage more detailed account settings (e.g., password change) if integrated with an external service like Supabase's user management UI.

9. Pricing and Features (PricingPage.jsx, FeaturesPage.jsx)

    Features Page: Displays key highlights and capabilities of the Portfolio Tracker application.

    Pricing Page: If the application offers different subscription tiers (e.g., Free, Premium), this page will show:

        Available plans.

        Billing cycle options (Monthly/Yearly).

        Price and features for each plan.

        Buttons to "Choose Plan".

10. Admin Dashboard (For Administrators) (AdminDashboard.jsx)

If you have administrator privileges, you can access the Admin Dashboard.

    User Management:

        View a list of all users.

        Refresh the user list.

        Update a user's Account Type (e.g., Free, Premium).

        Update a user's Role (e.g., Regular, Admin).

        Deactivate or Delete users.

    System Configuration:

        Set Default Currency for the application.

        Enable/Disable Capital Gains Tax (CGT) Calculation.

        Set upload limits for Free and Premium users.

        Set the Default Theme for new users.

        Click "Save Configuration" to apply changes.

11. Troubleshooting & FAQ

    CSV Import Fails:

        Ensure your CSV file matches the selected broker format or the generic Sharesight format.

        Check for missing or incorrectly named header columns.

        Make sure dates and numbers are in a recognizable format.

        Try importing a smaller subset of data to isolate issues.

    Data Not Updating:

        Try clicking the "Refresh" button on the relevant page.

        Ensure you have a stable internet connection.

    Incorrect Calculations:

        Verify all transaction data (buys, sells, dividends, fees) is entered accurately.

        Ensure correct currencies and exchange rates (if applicable) are set in General Settings.
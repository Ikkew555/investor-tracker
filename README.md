# Investor Tracker

Investor Tracker is a personal investment portfolio tracking application designed to help individual investors understand their portfolio performance, realised gains and losses, dividend income, CGT events, multi-currency exposure, and upcoming dividend payments.

The project was created as an individual version of a portfolio analytics system, with the branding changed to keep it independent and separate from any company or group project name.

## Project Overview

Many investors own shares across different companies, currencies, and time periods, but it can be difficult to clearly understand how the portfolio is actually performing. Investor Tracker aims to make this easier by turning investment data into useful summaries, tables, and visual insights.

The system can process portfolio data such as purchase parcels, disposals, dividends, current prices, and currency information. It then generates investment reports that help users answer questions such as:

* How much has my portfolio returned?
* Which shares have I sold?
* Did I make a realised gain or loss?
* How much dividend income did I receive?
* What is my expected future dividend income?
* Which holding contributed the most to my portfolio return?
* How much of my portfolio is exposed to different currencies?
* When are future dividend payments expected?

## Key Features

### Portfolio Performance

Shows the overall portfolio return across a selected period, including:

* Opening value
* Closing value
* Capital gain
* Dividend income
* Total return
* Return percentage
* Individual holding performance

### Sold Securities

Tracks securities that have been sold and calculates realised profit or loss. This helps users understand which trades were closed and whether each sale produced a gain or loss.

### Future Income Forecast

Estimates expected dividend income for the next 12 months based on existing holdings and previous dividend information.

### Contribution Analysis

Shows how much each holding contributed to the overall portfolio return. This is useful because a large holding with a small return can sometimes affect the portfolio more than a small holding with a high return.

### Multi-Currency Valuation

Groups holdings by currency and country. It helps users understand how much of their portfolio is exposed to different markets and currencies.

### Multi-Period Returns

Compares portfolio returns across different periods such as:

* 1 month
* 3 months
* 6 months
* 1 year
* 3 years
* 5 years
* Since inception

### Dividend Calendar

Displays projected upcoming dividend payments in a calendar-style view, helping users see when income may arrive.

### CGT and Dividend Reporting

Supports individual investor reporting by calculating:

* Gross capital gains
* Capital losses
* CGT discount
* Net capital gain
* Franking credits
* Grossed-up dividend income
* Remaining parcels after disposals

## Example Data

The project uses sample investment data including:

* Purchase parcels
* Share disposals
* Dividend payments
* Current prices
* Currency rates
* Symbol metadata

Example securities include Australian and international holdings such as CBA, BHP, CSL, TLS, WBC, and AAPL.

## Tech Stack

Update this section based on your actual project setup.

Possible stack:

* Frontend: React / Vite
* Backend: Python / JavaScript calculation engine
* Database: Supabase or JSON-based sample data
* Styling: CSS / Material UI
* Data format: JSON

## Folder Structure

```txt
investor-tracker/
├── frontend/
│   ├── src/
│   ├── public/
│   └── package.json
├── backend/
│   ├── tools/
│   ├── examples/
│   └── main.py
├── README.md
└── .gitignore
```

Adjust this structure depending on your actual files.

## Getting Started

### 1. Clone the repository

```bash
git clone https://github.com/your-username/investor-tracker.git
cd investor-tracker
```

### 2. Install dependencies

If the project uses a frontend folder:

```bash
cd frontend
npm install
```

If the project uses a Python backend:

```bash
cd backend
pip install -r requirements.txt
```

### 3. Run the project

Frontend:

```bash
npm run dev
```

Backend:

```bash
python main.py
```

Update these commands depending on your actual setup.

## Data Flow

The backend calculation tools process investment data and return structured JSON results. The frontend then displays each result in a separate tool section or tab.

```txt
Input Data
   ↓
Calculation Tools
   ↓
JSON Output
   ↓
Frontend Dashboard
```

Main report sections include:

* Performance
* Sold Securities
* Future Income
* Contribution Analysis
* Multi-Currency
* Multi-Period
* Calendar

## Purpose of the Project

This project was built to practise full-stack development, financial data processing, and dashboard-based user interface design. It focuses on making investment data easier to understand for individual users.

The project is not intended to replace professional financial or tax advice. It is designed for learning, portfolio analysis, and demonstration purposes.

## Future Improvements

Planned or possible improvements include:

* User authentication
* Broker CSV upload
* Supabase database integration
* More detailed CGT reporting
* Export to PDF or CSV
* Interactive charts
* Real-time market price integration
* Better mobile responsive design
* Dark mode dashboard
* More tax-year configuration options

## Disclaimer

This project is for educational and portfolio demonstration purposes only. The calculations and reports should not be treated as financial, investment, or tax advice. Users should verify all outputs before making financial decisions.

## Author

Created by Nathakorn Wimonwatwethi and university friends as an individual investment tracking project.

# Portfolio Tracker - Deployment Guide

This guide will help you install Docker on **Ubuntu 20.04** and run the `portfoliotracker` Docker container headlessly.

---

## 🚀 Quick Docker Installation (Ubuntu 20.04)

Run this **one-liner** to install Docker via the CLI:

> (Press ENTER if it prompts you to)

```bash
sudo apt update && sudo apt install -y apt-transport-https ca-certificates curl gnupg lsb-release && curl -fsSL https://download.docker.com/linux/ubuntu/gpg | sudo apt-key add - && sudo add-apt-repository "deb [arch=amd64] https://download.docker.com/linux/ubuntu focal stable" && sudo apt update && sudo apt install -y docker-ce docker-ce-cli containerd.io && sudo systemctl enable docker && sudo systemctl start docker && sudo docker --version
```

## 🛠️ Building and Running from Source

Since this project requires building the Docker image locally, follow the steps below.

### Step 1 – Build the Docker Image

In the project directory (where your `Dockerfile` is located), run:

```bash
docker build -t portfoliotracker .
```
### Step 2 – Run the Docker Container

After building the image, run the container in **detached mode** (so it runs in the background without needing an active shell):

```bash
docker run -d --name portfolio-app --restart unless-stopped -p 4173:4173 portfoliotracker
```
## 🎯 Access the App
Once the container is running, you can access the app in your browser at:
```bash
http://[YOUR_SERVER_IP]:4173
```

## 🔍 Useful Docker Commands

Here are some common Docker commands to help you manage your container.

### 📋 Check Running Containers
```bash
docker ps
```
## 📂 View Container Logs
```bash
docker logs -f portfolio-app
```
## 🛑 Stop the Container
```bash
docker stop portfolio-app
```
## ▶️ Start the Container
```bash
docker start portfolio-app
```
## 🗑️ Remove the Container
```bash
docker rm portfolio-app
```

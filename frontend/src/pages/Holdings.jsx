import React, { useState, useEffect } from "react";
import { supabase } from "../lib/supabase";
import SecurityChart from "../components/SecurityChart";
import CurrencyChart from "../components/CurrencyChart";
import MarketChart from "../components/MarketChart";
import TypeChart from "../components/TypeChart";

const Holdings = () => {
  const [transactions, setTransactions] = useState([]);
  const [total, setTotal] = useState(0);

  const loadTransactions = async () => {
    try {
      const { data, error } = await supabase
        .from("activities")
        .select(
          `
            *,
            securities:security_id (
              symbol,
              name,
              exchange,
              currency
            ),
            brokers:broker_id (
              name
            )
          `
        )
        .order("date", { ascending: false });

      if (error) throw error;

      const formattedTransactions = data.map((tx) => ({
        id: tx.id,
        type: tx.type,
        date: new Date(tx.date).toLocaleDateString(),
        market: tx.securities?.exchange || "",
        code: tx.securities?.symbol || "",
        securityName: tx.securities?.name || tx.securities?.symbol || "",
        quantity: tx.quantity,
        price: tx.price,
        brokerage: tx.fees,
        currency: tx.currency,
        totalAmount: tx.total_amount,
        broker: tx.brokers?.name || "",
        notes: tx.notes,
      }));

      const totalAmountSum = formattedTransactions.reduce(
        (sum, tx) => sum + (tx.totalAmount || 0),
        0
      );

      setTotal(totalAmountSum);

      setTransactions(formattedTransactions);
    } catch (error) {
      console.error("Error loading transactions:", error);
      throw error;
    }
  };

  useEffect(() => {
    const fetchData = async () => {
      try {
        await loadTransactions();
      } catch (error) {
        console.error("Error in initial data loading:", error);
      }
    };

    fetchData();
    return () => {};
  }, []);

  // Aggregation helpers
  const aggregateByKey = (key) => {
    const map = {};
    transactions.forEach((item) => {
      const total = item.price * item.quantity;
      map[item[key]] = (map[item[key]] || 0) + total;
    });
    return Object.entries(map).map(([name, value]) => ({ name, value }));
  };

  const marketData = aggregateByKey("market");
  const currencyData = aggregateByKey("currency");
  const securityData = aggregateByKey("code");
  const typeData = aggregateByKey("type"); 

  return (
    <div style={{ 
      padding: "60px", 
      height: "100vh", 
      width: "100vw",
      boxSizing: "border-box",
      overflow: "auto"
      }}>
      <h2>Holdings Summary</h2>

      {/* <h1>CASH: {total.toFixed(2)}</h1> */}

      <h1>
        CASH: {total.toLocaleString('en-AU', {
         style: 'currency',
            currency: 'AUD'
       })}
      </h1>


      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(2,1fr)",
          gap: "20px",
          marginBottom: "30px",
        }}
      >
        <SecurityChart data={securityData} />
        <CurrencyChart data={currencyData} />
        <MarketChart data={marketData} /> 
         <TypeChart data={typeData} />  
      </div>


    </div>
  );
};

export default Holdings;

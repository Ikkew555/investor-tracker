import React, { useState } from "react";
import "../components/PricingPage.css";

const pricingData = {
  monthly: [
    {
      title: "Free",
      price: "$0",
      features: ["1 Project", "Basic Support", "Limited Analytics"],
    },
    {
      title: "Premium",
      price: "$29",
      features: ["Unlimited Projects", "Priority Support", "Advanced Analytics"],
    },
  ],
  yearly: [
    {
      title: "Free",
      price: "$0",
      features: ["1 Project", "Basic Support", "Limited Analytics"],
    },
    {
      title: "Premium",
      price: "$290",
      features: ["Unlimited Projects", "Priority Support", "Advanced Analytics"],
    },
  ],
};

const PricingPage = () => {
  const [billingCycle, setBillingCycle] = useState("monthly");

  return (
    <div className="pricing-wrapper">
      <h1 className="pricing-title">Choose Your Plan</h1>

      <div className="billing-toggle">
        <button
          className={billingCycle === "monthly" ? "active" : ""}
          onClick={() => setBillingCycle("monthly")}
        >
          Monthly
        </button>
        <button
          className={billingCycle === "yearly" ? "active" : ""}
          onClick={() => setBillingCycle("yearly")}
        >
          Yearly
        </button>
      </div>

      <div className="pricing-grid">
        {pricingData[billingCycle].map((plan, index) => (
          <div className="pricing-card" key={index}>
            <h2>{plan.title}</h2>
            <div className="price">{plan.price}</div>
            <ul>
              {plan.features.map((feature, i) => (
                <li key={i}>{feature}</li>
              ))}
            </ul>
            <button className="choose-btn">Choose Plan</button>
          </div>
        ))}
      </div>
    </div>
  );
};

export default PricingPage;

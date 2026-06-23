import React from "react";
import "./WelcomeSection.css";

function WelcomeSection() {
  return (
    <div className="welcome-section">
      <h1>Welcome to Portfolio Tracker</h1>
      <div className="options">
        <button>Setup your Currency</button>
        <button>Add your accounts</button>
        <button>Import your activities</button>
      </div>
      <button className="get-started-button">Get Started</button>
    </div>
  );
}

export default WelcomeSection;

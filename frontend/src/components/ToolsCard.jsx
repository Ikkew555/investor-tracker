import React from "react";
import "./ToolsCard.css";

const ToolsCard = ({ toolList, onSelectTool }) => {
  return (
    <div className="tools-grid">
      {toolList.map((tool) => (
        <div
          key={tool.id}
          className="tools-card"
          onClick={() => onSelectTool(tool)}
        >
          <img
            src={tool.image}
            alt={tool.name}
            className="tools-card-image"
          />
          <h3 className="tools-card-title">{tool.name} <span style={{ fontSize: 16 }}>›</span></h3> 
          <p className="tools-card-desc">{tool.desc}</p>
        </div>
      ))}
    </div>
  );
};

export default ToolsCard;

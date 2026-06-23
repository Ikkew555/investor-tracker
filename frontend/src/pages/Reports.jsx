import React, { useState } from "react";
import { useNavigate } from "react-router-dom";
import { Box, Typography, Paper, Button, Grid, useTheme } from "@mui/material";
import Modal from "../components/Modal";

const reportSections = [
  {
    category: "Performance",
    reports: [
      {
        title: "Sold Securities",
        description: "Shows capital gains, dividends, and return values for sold holdings.",
        route: "sold-securities",
      },
      {
        title: "Performance",
        description: "Track portfolio performance over time.",
        route: "performance",
      },
      {
        title: "Brokers Performance",
        description: "Track portfolio performance over time.",
        route: "brokers-performance",
      },
    ],
  },
  {
    category: "Tax & Compliance",
    reports: [
{
       title: "Taxable Income",
      description: "Summarizes dividend and interest payments for tax purposes.",
       route: "taxable-income",
     },
      {
        title: "All Trades",
        description: "Lists all trades over the selected date range.",
        route: "all-trades",
      },
      {
        title: "Historic Cost",
        description: "Displays the historic cost basis of investments.",
        route: "historic-cost",
      },
    ],
  },
];

function Reports() {
  const [selected, setSelected] = useState(null);
  const navigate = useNavigate();
  const theme = useTheme();

  const handleOpen = (report) => setSelected(report);
  const handleClose = () => setSelected(null);
  const handleRunReport = () => {
    if (selected) {
      navigate(`/reports/${selected.route}`);
      handleClose();
    }
  };

  return (
    <Box sx={{ px: 4, py: 6 }}>
      <Typography variant="h4" gutterBottom fontWeight="bold">
        Reports
      </Typography>

      {reportSections.map((section, idx) => (
        <Box key={idx} sx={{ mb: 5 }}>
          <Typography variant="h6" gutterBottom>
            {section.category}
          </Typography>
          <Grid container spacing={3}>
            {section.reports.map((report, index) => (
              <Grid item xs={12} sm={6} md={4} key={index}>
                <Paper
                  elevation={3}
                  sx={{
                    p: 3,
                    height: "100%",
                    display: "flex",
                    flexDirection: "column",
                    justifyContent: "space-between",
                    bgcolor:
                      theme.palette.mode === "dark"
                        ? "#1e1e1e"
                        : theme.palette.background.paper,
                    "&:hover": {
                      boxShadow: 6,
                      transform: "scale(1.02)",
                      transition: "all 0.2s ease-in-out",
                    },
                  }}
                >
                  <Box>
                    <Typography variant="subtitle1" fontWeight={600}>
                      {report.title}
                    </Typography>
                    <Typography
                      variant="body2"
                      color="text.secondary"
                      sx={{ mt: 1 }}
                    >
                      {report.description}
                    </Typography>
                  </Box>
                  <Button
                    variant="contained"
                    onClick={() => handleOpen(report)}
                    sx={{ mt: 3, alignSelf: "flex-start" }}
                  >
                    View Report
                  </Button>
                </Paper>
              </Grid>
            ))}
          </Grid>
        </Box>
      ))}

      {selected && (
        <Modal onClose={handleClose}>
          <h2>{selected.title}</h2>
          <p>{selected.description}</p>
          <button onClick={handleRunReport}>Run Report</button>
        </Modal>
      )}
    </Box>
  );
}

export default Reports;

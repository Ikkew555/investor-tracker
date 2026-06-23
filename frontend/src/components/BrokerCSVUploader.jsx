import React, { useState } from "react";
import Papa from "papaparse";
import { useParams } from "react-router-dom";
import {
  Box,
  Button,
  Alert,
  Typography,
  LinearProgress,
  Skeleton,
} from "@mui/material";
import { UploadFile } from "@mui/icons-material";

import { parseBrokerCsvRows } from "../services/brokerCSVParser";
import { supabase } from "../lib/supabase";
import { refreshUser } from "../lib/api";

const brokerNameFromId = {
  commsec: "CommSec",
  nabtrade: "NABTrade",
  selfwealth: "Selfwealth",
  webull: "Webull",
};

const BrokerCSVUploader = ({ brokerName, brokerId, onUploadComplete }) => {
  const { brokerId: routeBrokerId } = useParams();

  const selectedBrokerId = brokerId || routeBrokerId || "";
  const displayBrokerName =
    brokerName ||
    brokerNameFromId[selectedBrokerId] ||
    selectedBrokerId ||
    "Broker";

  const [fileName, setFileName] = useState("");
  const [uploading, setUploading] = useState(false);
  const [message, setMessage] = useState(null);

  const showMessage = (severity, text) => {
    setMessage({ severity, text });
  };

  const findOrCreateBroker = async (userId) => {
    const { data: existingBrokers, error: findError } = await supabase
      .from("brokers")
      .select("id")
      .eq("user_id", userId)
      .ilike("name", `%${displayBrokerName}%`)
      .limit(1);

    if (findError) throw findError;

    if (existingBrokers && existingBrokers.length > 0) {
      return existingBrokers[0].id;
    }

    const { data: newBroker, error: insertError } = await supabase
      .from("brokers")
      .insert({
        user_id: userId,
        name: displayBrokerName,
      })
      .select("id")
      .single();

    if (insertError) throw insertError;

    return newBroker.id;
  };

  const findOrCreateSecurity = async (row) => {
    const symbol = String(row.symbol || "")
      .trim()
      .toUpperCase();

    if (!symbol) return null;

    const { data: existingSecurities, error: findError } = await supabase
      .from("securities")
      .select("id")
      .eq("symbol", symbol)
      .limit(1);

    if (findError) throw findError;

    if (existingSecurities && existingSecurities.length > 0) {
      return existingSecurities[0].id;
    }

    const { data: newSecurity, error: insertError } = await supabase
      .from("securities")
      .insert({
        symbol,
        name: row.securityName || symbol,
        exchange: row.market || "ASX",
        currency: row.currency || "AUD",

        // required by securities table
        asset_class: row.assetClass || "Equity",
      })
      .select("id")
      .single();

    if (insertError) throw insertError;

    return newSecurity.id;
  };

  const buildActivitiesPayload = async (parsedRows, userId, brokerDbId) => {
    const payload = [];

    for (const row of parsedRows) {
      const securityId = await findOrCreateSecurity(row);

      payload.push({
        user_id: userId,
        broker_id: brokerDbId,
        security_id: securityId,
        type: row.type,
        date: row.date,
        quantity: row.quantity,
        price: row.price,
        total_amount: row.totalAmount,
        fees: row.fees,
        currency: row.currency || "AUD",
        franking_credits: row.frankingCredits ?? null,
        notes: row.reference
          ? `Imported from ${displayBrokerName}. Ref: ${row.reference}`
          : `Imported from ${displayBrokerName}`,

        franking_percent: row.frankingPercent ?? null,
        reduced_cost_base: row.reducedCostBase ?? null,
      });
    }

    return payload;
  };

  const handleFileUpload = async (event) => {
    const file = event.target.files?.[0];
    if (!file) return;

    setFileName(file.name);
    setUploading(true);
    setMessage(null);

    Papa.parse(file, {
      header: true,
      skipEmptyLines: true,

      complete: async (results) => {
        try {
          const parsedRows = parseBrokerCsvRows(results.data, selectedBrokerId);

          if (parsedRows.length === 0) {
            throw new Error("No valid transactions found in this CSV file.");
          }

          const {
            data: { user },
            error: userError,
          } = await supabase.auth.getUser();

          if (userError || !user?.id) {
            throw new Error("User not authenticated.");
          }

          const brokerDbId = await findOrCreateBroker(user.id);

          const activitiesPayload = await buildActivitiesPayload(
            parsedRows,
            user.id,
            brokerDbId,
          );

          const { error: insertError } = await supabase
            .from("activities")
            .insert(activitiesPayload);

          if (insertError) throw insertError;

          refreshUser(user.id).catch((err) =>
            console.warn("Could not trigger recalculation:", err),
          );

          showMessage(
            "success",
            `Successfully imported ${activitiesPayload.length} records.`,
          );

          onUploadComplete?.({
            importedCount: activitiesPayload.length,
            rows: parsedRows,
            rawRows: results.data,
            rawHeaders: results.meta?.fields || [],
          });
        } catch (error) {
          console.error("CSV upload error:", error);
          showMessage("error", error.message || "Could not upload CSV file.");
        } finally {
          setUploading(false);
          event.target.value = "";
        }
      },

      error: (error) => {
        console.error("CSV parse error:", error);
        showMessage("error", "Could not read this CSV file.");
        setUploading(false);
        event.target.value = "";
      },
    });
  };

  return (
    <Box>
      <Typography variant="h6" fontWeight="bold" gutterBottom>
        Upload {displayBrokerName} CSV
      </Typography>

      <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
        Choose the correct CSV file for this broker. Files from another broker
        will be rejected.
      </Typography>

      {message && (
        <Alert severity={message.severity} sx={{ mb: 2 }}>
          {message.text}
        </Alert>
      )}

      <Box
        sx={{
          border: "1px dashed #b8c2d6",
          borderRadius: 3,
          p: 3,
          background: "rgba(79, 124, 255, 0.04)",
          textAlign: "center",
        }}
      >
        {uploading ? (
          <>
            <Skeleton variant="rounded" height={80} sx={{ borderRadius: 2 }} />
            <LinearProgress sx={{ mt: 2 }} />

            <Typography variant="body2" color="text.secondary" sx={{ mt: 1 }}>
              Importing CSV data...
            </Typography>
          </>
        ) : (
          <>
            <UploadFile sx={{ fontSize: 44, color: "#4f7cff", mb: 1 }} />

            <Typography fontWeight="bold" sx={{ mb: 0.5 }}>
              Upload broker CSV file
            </Typography>

            <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
              Supported provider: {displayBrokerName}
            </Typography>

            <Button
              component="label"
              variant="contained"
              startIcon={<UploadFile />}
            >
              Choose CSV File
              <input
                hidden
                type="file"
                accept=".csv,text/csv"
                onChange={handleFileUpload}
              />
            </Button>

            {fileName && (
              <Typography variant="body2" sx={{ mt: 1 }} color="text.secondary">
                Selected file: {fileName}
              </Typography>
            )}
          </>
        )}
      </Box>
    </Box>
  );
};

export default BrokerCSVUploader;

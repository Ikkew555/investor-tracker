// src/services/toolsApi.js

import { apiGet } from "./apiClient";

// Generic feature endpoint
export function getToolFeature(featureName, userId) {
  return apiGet(`/api/feature/${featureName}/${userId}`);
}

// Individual helpers
export const getPerformance = (userId) => 
  getToolFeature("performance", userId);

export const getSoldSecurities = (userId) =>
  getToolFeature("sold_securities", userId);

export const getFutureIncome = (userId) =>
  getToolFeature("future_income", userId);

export const getContributionAnalysis = (userId) =>
  getToolFeature("contribution_analysis", userId);

export const getMultiCurrency = (userId) =>
  getToolFeature("multi_currency", userId);

export const getMultiPeriod = (userId) =>
  getToolFeature("multi_period", userId);

export const getCalendar = (userId) =>
  getToolFeature("calendar", userId);

export const getRecentUploadActivities = (userId) =>
  apiGet(`/api/activities/recent-upload/${userId}`);

export const getLatestDividend = (userId) =>
  apiGet(`/api/activities/latest-dividend/${userId}`);

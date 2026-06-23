import React, { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";

import { Skeleton, Alert } from "@mui/material";

import "../components/tools-theme.css";
import "../components/Calendar.css";

import { getCalendar } from "../services/toolsApi";
import { useAuth } from "../contexts/AuthContext";

const CalendarPage = () => {
  const { user, loading: authLoading } = useAuth();
  const userId = user?.id;

  const today = new Date();
  const [currentDate, setCurrentDate] = useState(
    new Date(today.getFullYear(), today.getMonth(), 1),
  );

  const { data: result, isLoading: loading, error } = useQuery({
    queryKey: ["calendar", userId],
    queryFn:  () => getCalendar(userId),
    staleTime: 86_400_000, // 24 h — Group D engine
    enabled:  !authLoading && !!userId,
  });

  // mart field: event_date (not date), projected_amount (not amount)
  const rows = result?.data ?? [];
  const events = useMemo(() => rows.map(r => ({
    ...r,
    date:   r.event_date,
    amount: parseFloat(r.projected_amount || 0),
  })), [rows]);
  const summary = useMemo(() => ({
    total_events:          events.length,
    total_expected_income: events.reduce((s, e) => s + e.amount, 0),
  }), [events]);
  const warning = result?.warning || null;

  const sortedEvents = [...events].sort(
    (a, b) => new Date(a.date) - new Date(b.date),
  );

  const nextEvent =
    sortedEvents.find((event) => new Date(event.date) >= today) ||
    sortedEvents[0];

  const money = (value) =>
    new Intl.NumberFormat("en-AU", {
      style: "currency",
      currency: "AUD",
      maximumFractionDigits: 0,
    }).format(Number(value || 0));

  const formatDate = (date) =>
    new Date(date).toLocaleDateString("en-AU", {
      day: "2-digit",
      month: "short",
      year: "numeric",
    });

  const getFrequencyLabel = (days) => {
    if (days <= 31) return "Monthly";
    if (days <= 100) return "Quarterly";
    if (days <= 200) return "Semi-Annual";
    return "Annual";
  };

  const monthName = currentDate.toLocaleDateString("en-AU", {
    month: "long",
    year: "numeric",
  });

  const currentMonthEvents = events.filter((event) => {
    const eventDate = new Date(event.date);

    return (
      eventDate.getMonth() === currentDate.getMonth() &&
      eventDate.getFullYear() === currentDate.getFullYear()
    );
  });

  const calendarDays = useMemo(() => {
    const year = currentDate.getFullYear();
    const month = currentDate.getMonth();

    const firstDay = new Date(year, month, 1);
    const lastDay = new Date(year, month + 1, 0);

    const startDay = firstDay.getDay() === 0 ? 6 : firstDay.getDay() - 1;

    const days = [];

    for (let i = 0; i < startDay; i++) {
      days.push(null);
    }

    for (let day = 1; day <= lastDay.getDate(); day++) {
      days.push(new Date(year, month, day));
    }

    return days;
  }, [currentDate]);

  const getEventsForDay = (day) => {
    if (!day) return [];

    return events.filter((event) => {
      const eventDate = new Date(event.date);

      return (
        eventDate.getDate() === day.getDate() &&
        eventDate.getMonth() === day.getMonth() &&
        eventDate.getFullYear() === day.getFullYear()
      );
    });
  };

  const goPrevMonth = () => {
    setCurrentDate(
      new Date(currentDate.getFullYear(), currentDate.getMonth() - 1, 1),
    );
  };

  const goNextMonth = () => {
    setCurrentDate(
      new Date(currentDate.getFullYear(), currentDate.getMonth() + 1, 1),
    );
  };

  const goToday = () => {
    const now = new Date();

    setCurrentDate(new Date(now.getFullYear(), now.getMonth(), 1));
  };

  const goNextEvent = () => {
    if (!nextEvent) return;

    const eventDate = new Date(nextEvent.date);

    setCurrentDate(new Date(eventDate.getFullYear(), eventDate.getMonth(), 1));
  };

  const renderSkeletonCards = () =>
    Array.from({ length: 3 }).map((_, index) => (
      <div className="tool-card" key={index}>
        <Skeleton variant="text" width={140} height={28} />

        <Skeleton variant="text" width={120} height={42} />

        <Skeleton variant="text" width={100} height={24} />
      </div>
    ));

  return (
    <div className="tool-page">
      <div className="tool-hero">
        <div className="error-fix">
          <p className="tool-hero-title">Dividend Calendar</p>

          <p className="tool-hero-subtitle">
            Projected dividend payments and income events for the next 12
            months.
          </p>
        </div>

        <div className="tool-badge">
          {loading ? (
            <Skeleton variant="text" width={120} height={28} />
          ) : (
            "Next 12 months"
          )}
        </div>
      </div>

      {warning && (
        <Alert severity="warning" sx={{ mb: 2 }}>
          {warning}
        </Alert>
      )}

      {error && (
        <Alert severity="error" sx={{ mb: 2 }}>
          {error}
        </Alert>
      )}

      <div className="tool-grid">
        {loading ? (
          renderSkeletonCards()
        ) : (
          <>
            <div className="tool-card">
              <p className="tool-label">Total Events</p>

              <h3 className="tool-value">{summary.total_events || 0}</h3>

              <span className="tool-subtext">Scheduled payments</span>
            </div>

            <div className="tool-card">
              <p className="tool-label">Expected Income</p>

              <h3 className="tool-value positive-value">
                {money(summary.total_expected_income)}
              </h3>

              <span className="tool-subtext positive-value">
                Forecast income
              </span>
            </div>

            <div className="tool-card clickable" onClick={goNextEvent}>
              <p className="tool-label">Next Event</p>

              <h3 className="tool-value">
                {nextEvent ? nextEvent.symbol : "-"}
              </h3>

              <span className="tool-subtext">
                {nextEvent ? formatDate(nextEvent.date) : "No upcoming event"}
              </span>
            </div>
          </>
        )}
      </div>

      <div className="tool-panel calendar-panel">
        <div className="calendar-month-toolbar">
          <div className="calendar-month-center">
            <button
              className="calendar-nav-btn"
              onClick={goPrevMonth}
              aria-label="Previous month"
              disabled={loading}
            >
              ←
            </button>

            <div className="month-center">
              {loading ? (
                <>
                  <Skeleton variant="text" width={180} height={36} />

                  <Skeleton variant="text" width={120} height={22} />
                </>
              ) : (
                <>
                  <h3>{monthName}</h3>

                  <p>{currentMonthEvents.length} event(s) this month</p>
                </>
              )}
            </div>

            <button
              className="calendar-nav-btn"
              onClick={goNextMonth}
              aria-label="Next month"
              disabled={loading}
            >
              →
            </button>
          </div>

          <button className="today-btn" onClick={goToday} disabled={loading}>
            Today
          </button>
        </div>

        <div className="calendar-weekdays">
          {["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"].map((day) => (
            <div key={day}>{day}</div>
          ))}
        </div>

        <div className="calendar-grid">
          {loading
            ? Array.from({ length: 35 }).map((_, index) => (
                <div key={index} className="calendar-day">
                  <Skeleton variant="text" width={28} height={24} />

                  <Skeleton variant="rounded" width="90%" height={22} />
                </div>
              ))
            : calendarDays.map((day, index) => {
                const dayEvents = getEventsForDay(day);

                const isToday =
                  day && day.toDateString() === today.toDateString();

                return (
                  <div
                    key={index}
                    className={`calendar-day ${
                      dayEvents.length ? "has-event" : ""
                    } ${isToday ? "today" : ""}`}
                  >
                    {day && (
                      <>
                        <span className="day-number">{day.getDate()}</span>

                        <div className="event-chip-list">
                          {dayEvents.slice(0, 2).map((event) => (
                            <div
                              key={event.symbol + event.date}
                              className="event-chip"
                            >
                              💰 {event.symbol}
                            </div>
                          ))}

                          {dayEvents.length > 2 && (
                            <div className="event-more">
                              +{dayEvents.length - 2} more
                            </div>
                          )}
                        </div>
                      </>
                    )}
                  </div>
                );
              })}
        </div>
      </div>

      <div className="tool-panel calendar-events-panel">
        <div className="tool-panel-header">
          <div>
            <h3 className="tool-panel-title">This Month</h3>

            <p className="tool-panel-subtitle">
              Dividend events in {monthName}
            </p>
          </div>

          <span className="tool-badge">
            {loading ? (
              <Skeleton variant="text" width={70} height={24} />
            ) : (
              `${currentMonthEvents.length} records`
            )}
          </span>
        </div>

        <div className="event-list">
          {loading ? (
            Array.from({ length: 4 }).map((_, index) => (
              <div key={index} className="event-row">
                <div>
                  <Skeleton variant="text" width={80} height={28} />

                  <Skeleton variant="text" width={120} height={20} />
                </div>

                <div className="event-right">
                  <Skeleton variant="text" width={90} height={28} />

                  <Skeleton variant="rounded" width={90} height={28} />
                </div>
              </div>
            ))
          ) : currentMonthEvents.length === 0 ? (
            <p className="tool-empty">No events for this month.</p>
          ) : (
            currentMonthEvents.map((event) => (
              <div key={event.symbol + event.date} className="event-row">
                <div>
                  <strong>{event.symbol}</strong>

                  <p>{formatDate(event.date)}</p>
                </div>

                <div className="event-right">
                  <strong>{money(event.amount)}</strong>

                  <span className="tool-badge">
                    {getFrequencyLabel(event.frequency_days)}
                  </span>
                </div>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
};

export default CalendarPage;

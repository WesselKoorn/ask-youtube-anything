"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { useCallback } from "react";
import styles from "./faq-filters.module.scss";

export default function FAQFilters() {
  const router = useRouter();
  const searchParams = useSearchParams();

  const createQueryString = useCallback(
    (name: string, value: string) => {
      const params = new URLSearchParams(searchParams.toString());
      if (value) {
        params.set(name, value);
      } else {
        params.delete(name);
      }
      return params.toString();
    },
    [searchParams]
  );

  const handleSearchChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    router.push(`/faq?${createQueryString("searchQuery", e.target.value)}`);
  };

  const handleDateChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    router.push(`/faq?${createQueryString(e.target.name, e.target.value)}`);
  };

  const handleFrequencyChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    router.push(`/faq?${createQueryString("minFrequency", e.target.value)}`);
  };

  return (
    <div className={styles.filters}>
      <div className={styles.filterGrid}>
        <div className={styles.filterGroup}>
          <label htmlFor="searchQuery" className={styles.label}>
            Search Questions
          </label>
          <input
            type="text"
            id="searchQuery"
            className={styles.input}
            placeholder="Search questions..."
            value={searchParams.get("searchQuery") || ""}
            onChange={handleSearchChange}
          />
        </div>

        <div className={styles.filterGroup}>
          <label htmlFor="startDate" className={styles.label}>
            Start Date
          </label>
          <input
            type="date"
            id="startDate"
            name="startDate"
            className={styles.dateInput}
            value={searchParams.get("startDate") || ""}
            onChange={handleDateChange}
          />
        </div>

        <div className={styles.filterGroup}>
          <label htmlFor="endDate" className={styles.label}>
            End Date
          </label>
          <input
            type="date"
            id="endDate"
            name="endDate"
            className={styles.dateInput}
            value={searchParams.get("endDate") || ""}
            onChange={handleDateChange}
          />
        </div>

        <div className={styles.filterGroup}>
          <label htmlFor="minFrequency" className={styles.label}>
            Minimum Frequency
          </label>
          <input
            type="number"
            id="minFrequency"
            className={styles.numberInput}
            min="1"
            value={searchParams.get("minFrequency") || ""}
            onChange={handleFrequencyChange}
          />
        </div>
      </div>
    </div>
  );
} 
"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { useCallback } from "react";

export default function FAQFilters() {
  const router = useRouter();
  const searchParams = useSearchParams();

  const createQueryString = useCallback(
    (name: string, value: string) => {
      const params = new URLSearchParams(searchParams.toString());
      params.set(name, value);
      return params.toString();
    },
    [searchParams]
  );

  const handleSearch = (e: React.ChangeEvent<HTMLInputElement>) => {
    router.push(`/faq?${createQueryString("searchQuery", e.target.value)}`);
  };

  const handleDateChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target;
    router.push(`/faq?${createQueryString(name, value)}`);
  };

  const handleFrequencyChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    router.push(`/faq?${createQueryString("minFrequency", e.target.value)}`);
  };

  return (
    <div className="bg-white p-4 rounded-lg shadow mb-8">
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <div>
          <label htmlFor="searchQuery" className="block text-sm font-medium text-gray-700 mb-1">
            Search
          </label>
          <input
            type="text"
            id="searchQuery"
            name="searchQuery"
            placeholder="Search questions..."
            className="w-full px-3 py-2 border border-gray-300 rounded-md"
            defaultValue={searchParams.get("searchQuery") || ""}
            onChange={handleSearch}
          />
        </div>

        <div>
          <label htmlFor="startDate" className="block text-sm font-medium text-gray-700 mb-1">
            Start Date
          </label>
          <input
            type="date"
            id="startDate"
            name="startDate"
            className="w-full px-3 py-2 border border-gray-300 rounded-md"
            defaultValue={searchParams.get("startDate") || ""}
            onChange={handleDateChange}
          />
        </div>

        <div>
          <label htmlFor="endDate" className="block text-sm font-medium text-gray-700 mb-1">
            End Date
          </label>
          <input
            type="date"
            id="endDate"
            name="endDate"
            className="w-full px-3 py-2 border border-gray-300 rounded-md"
            defaultValue={searchParams.get("endDate") || ""}
            onChange={handleDateChange}
          />
        </div>

        <div>
          <label htmlFor="minFrequency" className="block text-sm font-medium text-gray-700 mb-1">
            Min Frequency
          </label>
          <input
            type="number"
            id="minFrequency"
            name="minFrequency"
            min="1"
            placeholder="Minimum times asked"
            className="w-full px-3 py-2 border border-gray-300 rounded-md"
            defaultValue={searchParams.get("minFrequency") || ""}
            onChange={handleFrequencyChange}
          />
        </div>
      </div>
    </div>
  );
} 
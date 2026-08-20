"use client";

import { Download } from "lucide-react";

type ExportActionsProps = {
  businesses: any[];
  users: any[];
  appointments: any[];
};

export function ExportActions({ businesses, users, appointments }: ExportActionsProps) {
  
  function downloadCSV(filename: string, rows: any[]) {
    if (!rows || !rows.length) {
      alert("No data to export");
      return;
    }
    
    // Extract headers
    const headers = Object.keys(rows[0]).join(",");
    
    // Extract rows
    const csvData = rows.map(row => {
      return Object.values(row).map(val => {
        // Handle strings with commas by wrapping in quotes
        if (typeof val === "string") {
          return `"${val.replace(/"/g, '""')}"`;
        }
        // Handle nulls
        if (val === null || val === undefined) {
          return "";
        }
        return val;
      }).join(",");
    }).join("\n");
    
    const csvString = `${headers}\n${csvData}`;
    const blob = new Blob([csvString], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    
    const link = document.createElement("a");
    link.setAttribute("href", url);
    link.setAttribute("download", `${filename}_${new Date().toISOString().split("T")[0]}.csv`);
    link.style.visibility = "hidden";
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  }

  return (
    <div className="grid gap-4 sm:grid-cols-3">
      <div className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm flex flex-col items-start">
        <h3 className="font-black text-ink">Businesses</h3>
        <p className="mt-1 text-sm text-ink/60 mb-4">{businesses.length} total records</p>
        <button
          onClick={() => downloadCSV("booknest_businesses", businesses)}
          className="mt-auto flex items-center gap-2 rounded-lg bg-purple-100 px-4 py-2 text-sm font-bold text-purple-700 transition hover:bg-purple-200"
        >
          <Download className="h-4 w-4" />
          Export CSV
        </button>
      </div>
      
      <div className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm flex flex-col items-start">
        <h3 className="font-black text-ink">Users</h3>
        <p className="mt-1 text-sm text-ink/60 mb-4">{users.length} total records</p>
        <button
          onClick={() => downloadCSV("booknest_users", users)}
          className="mt-auto flex items-center gap-2 rounded-lg bg-sky-100 px-4 py-2 text-sm font-bold text-sky-700 transition hover:bg-sky-200"
        >
          <Download className="h-4 w-4" />
          Export CSV
        </button>
      </div>

      <div className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm flex flex-col items-start">
        <h3 className="font-black text-ink">Appointments</h3>
        <p className="mt-1 text-sm text-ink/60 mb-4">{appointments.length} total records</p>
        <button
          onClick={() => downloadCSV("booknest_appointments", appointments)}
          className="mt-auto flex items-center gap-2 rounded-lg bg-emerald-100 px-4 py-2 text-sm font-bold text-emerald-700 transition hover:bg-emerald-200"
        >
          <Download className="h-4 w-4" />
          Export CSV
        </button>
      </div>
    </div>
  );
}

import * as XLSX from "xlsx";
import type { Employee } from "@/lib/types";

export function exportEmployeesXlsx(employees: Employee[], filenameStem = "talent-iq-export") {
  const rows = employees.map((e) => ({
    "Employee ID": e.emp_id,
    Name: e.name,
    Email: e.email ?? "",
    "Job Title": e.job_title ?? "",
    Level: e.level ?? "",
    Department: e.department,
    "Sub-Vertical": e.sub_vertical ?? "",
    Manager: e.manager_email,
    "Roll-up Manager": e.rollup_manager_email ?? "",
    "Function Head": e.function_head_email ?? "",
    "H2 Rating": e.h2_rating,
    "Potential Rating": e.potential_rating,
    "9-Box": e.nine_box_quadrant,
    "Attrition Risk": e.attrition_risk,
    "RAG Status": e.rag_status,
    Active: e.active ? "Yes" : "No",
    "Joining Date": e.joining_date,
    "Succession Notes": e.succession_notes ?? "",
    "Future Career Path": e.future_career_path ?? "",
    "HRBP Insights": e.hrbp_insights ?? "",
  }));
  const ws = XLSX.utils.json_to_sheet(rows);
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, "Team");
  const date = new Date().toISOString().slice(0, 10);
  XLSX.writeFile(wb, `${filenameStem}-${date}.xlsx`);
}

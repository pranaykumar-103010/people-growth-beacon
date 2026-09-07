# Talent Compass

I am an HRBP building a high-impact 'Talent & Retention Intelligence' dashboard for our Tech team at Field Assist. I need you to build a secure, multi-tenant web application with the following architecture:

1. Data Architecture & Security (Critical):

Create a Supabase database structure with two primary tables: 'employees' and 'users'.

The 'employees' table must include fields: id, name, sub_department, manager_email, risk_score (0-100), performance_rating (1-5), nine_box_quadrant (e.g., 'Star', 'Core', 'Development'), and induction_status (90-day progress).

Implement Row Level Security (RLS) so that when a manager logs in, they ONLY see employees where 'manager_email' matches their logged-in email.

Create an 'HRBP_Admin' role that bypasses these filters to view the aggregate dashboard for all sub-departments.

2. Dashboard Pages (UI/UX):

Home/Command Center: A clean, professional landing page for managers. It must feature:

Top KPI cards: 'Total Team Size', 'Avg Attrition Risk', 'New Joiners in Induction'.

An 'Attention Required' list: Automatically surfacing employees with a risk_score > 70.

A 'Call to Action' button per at-risk employee: 'Suggest Stay Conversation Questions' (using integrated AI).

Talent Matrix (9-Box): An interactive, visual 3x3 grid. Clicking on a quadrant must open a filtered drawer showing the names and profiles of employees in that specific segment.

Attrition Radar: A detailed view showing risk trends and key drivers. Include an 'HRBP Insight' section on each employee profile where I can leave private notes.

New Joiner Tracker: A dedicated view for employees with < 90 days tenure, tracking their induction plan completion status.

3. Visual Style:

The design should be modern, minimalist, and enterprise-grade. Use a professional color palette (Deep Navy, Slate Blue, and clean White).

Use clear visual indicators (Green/Amber/Red) for RAG status.

Ensure all charts and tables are responsive and mobile-friendly for managers on the go.

4. Proactive Logic:

Integrate a feature that allows me (the HRBP) to input raw 1-on-1 notes for an employee, and have the app trigger an automated analysis that updates the 'risk_score' and 'nine_box_quadrant' fields based on keywords (e.g., burnout, career growth, compensation).

Please start by setting up the database schema and then build the 'Command Center' page first. Ask me if you need clarity on the data relationships.

This project was built with [Lovable](https://lovable.dev).

## Build with Lovable

Continue developing this project in the [Lovable editor](https://lovable.dev/projects/e1478129-5be2-48a3-8607-25a7a18e9ddf).

- **Ship faster**: describe what you want to build and Lovable handles the code.
- **Stay in sync**: every change made in Lovable is committed straight to this repository.
- **Full ownership**: this code is yours. Push to `main` on GitHub and your changes sync back into Lovable, ready for your next prompt.

## Development

Prefer working locally? You need Node.js and npm — [install with nvm](https://github.com/nvm-sh/nvm#installing-and-updating).

```sh
git clone <this-repository-url>
cd <repository-name>
npm i
npm run dev
```

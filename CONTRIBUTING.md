# Contributing Guidelines

Welcome to the BookNest collaborative development repository! This project is prepared for your team assignment. Please follow these guidelines to coordinate work, review changes, and maintain high code quality.

---

## 🛠️ Local Project Setup

To get the project running locally, follow these steps:

### 1. Prerequisites
- **Node.js**: Version 20.x is recommended.
- **npm** (comes packaged with Node.js).

### 2. Installation
Clone the repository and install the dependencies:
```bash
git clone <your-repository-url>
cd Acuity
npm install
```

### 3. Environment Variables
Create a `.env.local` file by copying the template:
```bash
cp .env.example .env.local
```
Then, update `.env.local` with your team's Supabase credentials:
```env
NEXT_PUBLIC_SUPABASE_URL=https://your-project-ref.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-supabase-anon-key
NEXT_PUBLIC_SITE_URL=http://localhost:3000
```

### 4. Database Setup
Sign in to your team's Supabase account and run the migrations located in the [supabase/migrations/](file:///c:/Users/Adetola/Desktop/Acuity/supabase/migrations) directory in order (001 to 016). You can copy-paste them into the Supabase SQL editor.
Finally, to set up the default salon catalog, copy and run the SQL script in [supabase/seed.sql](file:///c:/Users/Adetola/Desktop/Acuity/supabase/seed.sql).

### 5. Running the App
Start the development server:
```bash
npm run dev
```
Open [http://localhost:3000](http://localhost:3000) in your browser to see the application running.

---

## 🌿 Git Branching Strategy

To keep the codebase clean and avoid conflict, do **not** push directly to the `main` branch. Always work in branches.

* **`main`**: The stable branch. Code here must always compile and run without errors.
* **Feature Branches**: Named `feature/<issue-number>-<short-description>` (e.g., `feature/12-dark-mode`).
* **Bugfix Branches**: Named `bugfix/<issue-number>-<short-description>` (e.g., `bugfix/34-fix-validation`).

### Git Cheat Sheet
1. **Update your local main branch**:
   ```bash
   git checkout main
   git pull origin main
   ```
2. **Create and switch to your feature branch**:
   ```bash
   git checkout -b feature/issue-num-desc
   ```
3. **Commit your changes**:
   Keep commits logical and prefix messages with the issue number:
   ```bash
   git add .
   git commit -m "#12: Add dark mode toggle component"
   ```
4. **Push branch to GitHub**:
   ```bash
   git push origin feature/issue-num-desc
   ```

---

## 📋 Tracking Tasks with Issues

All tasks, features, and bugs should be tracked using GitHub Issues.
1. Before starting any work, check the open issues list on GitHub.
2. Assign the issue to yourself (or coordinate with your teammate).
3. If you find a new bug or suggest a new feature, open a new issue first before writing code.
4. Set appropriate labels (e.g., `bug`, `enhancement`, `documentation`, `good-first-issue`).

---

## 🤝 Pull Requests & Code Reviews

Once your feature or fix is ready, submit a Pull Request (PR) to merge your branch into `main`.

### Creating a PR
- Set the target branch to `main`.
- Add a descriptive title and fill out the PR description template.
- Link the PR to the issue by adding `Closes #12` (or whatever the issue number is) in the description.
- Request review from at least one classmate/team member.

### Reviewing a PR
As a reviewer:
- Check that the automated **CI checks** (TypeScript verification and build test) pass.
- Review the code diffs for readability, correctness, and clean styling.
- Run the code locally if needed to test the behavior.
- Approve the PR or request changes.

### Merging
A branch should only be merged into `main` after:
- At least one approval from a teammate.
- The automated GitHub Actions build check has passed successfully.

---

## 🚨 Pre-commit Checks

Before committing and pushing your code, run the following checks locally to ensure your branch does not fail the CI build check:
- **Type Checking**:
  ```bash
  npm run typecheck
  ```
- **Local Build**:
  ```bash
  npm run build
  ```

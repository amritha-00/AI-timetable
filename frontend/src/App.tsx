import { Route, Routes } from "react-router-dom"
import { AppShell } from "@/components/layout/AppShell"
import { RequireAuth } from "@/components/layout/RequireAuth"
import { RootRedirect } from "@/components/layout/RootRedirect"
import { ErrorBoundary } from "@/components/features/shared/ErrorBoundary"
import AdminLoginPage from "@/pages/admin/AdminLogin"
import AdminPanel from "@/pages/admin/AdminPanel"
import LoginPage from "@/pages/auth/Login"
import SignupPage from "@/pages/auth/Signup"
import Dashboard from "@/pages/Dashboard"
import ConstraintsPage from "@/pages/Constraints"
import GeneratePage from "@/pages/Generate"
import NotFound from "@/pages/NotFound"
import SettingsPage from "@/pages/Settings"
import TimetablesPage from "@/pages/Timetables"
import ClassesPage from "@/pages/setup/ClassesPage"
import PeriodsPage from "@/pages/setup/PeriodsPage"
import RoomsPage from "@/pages/setup/RoomsPage"
import SubjectsPage from "@/pages/setup/SubjectsPage"
import TeachersPage from "@/pages/setup/TeachersPage"

export default function App() {
  return (
    <ErrorBoundary>
      <Routes>
        <Route index element={<RootRedirect />} />
        <Route path="login" element={<LoginPage />} />
        <Route path="signup" element={<SignupPage />} />
        <Route path="admin/login" element={<AdminLoginPage />} />
        <Route path="admin" element={<AdminPanel />} />
        <Route element={<RequireAuth />}>
          <Route element={<AppShell />}>
            <Route path="dashboard" element={<Dashboard />} />
            <Route path="setup/teachers" element={<TeachersPage />} />
            <Route path="setup/subjects" element={<SubjectsPage />} />
            <Route path="setup/classes" element={<ClassesPage />} />
            <Route path="setup/rooms" element={<RoomsPage />} />
            <Route path="setup/periods" element={<PeriodsPage />} />
            <Route path="constraints" element={<ConstraintsPage />} />
            <Route path="generate" element={<GeneratePage />} />
            <Route path="timetables" element={<TimetablesPage />} />
            <Route path="settings" element={<SettingsPage />} />
            <Route path="*" element={<NotFound />} />
          </Route>
        </Route>
      </Routes>
    </ErrorBoundary>
  )
}

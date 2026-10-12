import { Route, Routes } from 'react-router-dom'
import Layout from './components/Layout'
import ConstraintsPage from './pages/ConstraintsPage'
import DataManagementPage from './pages/DataManagementPage'
import GeneratePage from './pages/GeneratePage'
import TimetableViewerPage from './pages/TimetableViewerPage'

export default function App() {
  return (
    <Routes>
      <Route element={<Layout />}>
        <Route path="/" element={<DataManagementPage />} />
        <Route path="/constraints" element={<ConstraintsPage />} />
        <Route path="/generate" element={<GeneratePage />} />
        <Route path="/viewer" element={<TimetableViewerPage />} />
      </Route>
    </Routes>
  )
}

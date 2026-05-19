import { BrowserRouter, Routes, Route } from 'react-router-dom';
import Layout from './components/Layout';
import TrackerPage from './pages/TrackerPage';
import KotakPage from './pages/KotakPage';
import './App.css';

export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route element={<Layout />}>
          <Route index element={<TrackerPage />} />
          <Route path="kotak" element={<KotakPage />} />
        </Route>
      </Routes>
    </BrowserRouter>
  );
}

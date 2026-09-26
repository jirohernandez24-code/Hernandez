import { lazy, Suspense } from 'react';
import { BrowserRouter, Routes, Route } from 'react-router-dom';
import { SimulationProvider } from './context/SimulationContext';
import Layout from './components/Layout';
import PDFUpload from './components/PDFUpload';
import ScenarioLibrary from './components/ScenarioLibrary';
import SimulationView from './components/SimulationView';

// three.js is large, so the 3D ward is loaded only when opened
const Ward3D = lazy(() => import('./components/Ward3D'));

export default function App() {
  return (
    <SimulationProvider>
      <BrowserRouter>
        <Routes>
          <Route path="/" element={<Layout />}>
            <Route index element={<PDFUpload />} />
            <Route path="scenarios" element={<ScenarioLibrary />} />
            <Route path="simulate/:scenarioId" element={<SimulationView />} />
            <Route
              path="ward3d"
              element={
                <Suspense fallback={<div className="p-8 text-center text-gray-500">Loading 3D ward…</div>}>
                  <Ward3D />
                </Suspense>
              }
            />
          </Route>
        </Routes>
      </BrowserRouter>
    </SimulationProvider>
  );
}

import { BrowserRouter, Routes, Route } from 'react-router-dom';
import { SimulationProvider } from './context/SimulationContext';
import Layout from './components/Layout';
import PDFUpload from './components/PDFUpload';
import ScenarioLibrary from './components/ScenarioLibrary';
import SimulationView from './components/SimulationView';

export default function App() {
  return (
    <SimulationProvider>
      <BrowserRouter>
        <Routes>
          <Route path="/" element={<Layout />}>
            <Route index element={<PDFUpload />} />
            <Route path="scenarios" element={<ScenarioLibrary />} />
            <Route path="simulate/:scenarioId" element={<SimulationView />} />
          </Route>
        </Routes>
      </BrowserRouter>
    </SimulationProvider>
  );
}

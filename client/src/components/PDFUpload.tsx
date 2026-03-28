import { useState, useCallback, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { uploadPDF, generateScenario } from '../utils/api';
import GeneratingOverlay from './GeneratingOverlay';

export default function PDFUpload() {
  const [isDragging, setIsDragging] = useState(false);
  const [uploadedFile, setUploadedFile] = useState<{ name: string; chunks: string[]; preview: string; numPages: number } | null>(null);
  const [isUploading, setIsUploading] = useState(false);
  const [isGenerating, setIsGenerating] = useState(false);
  const [difficulty, setDifficulty] = useState('moderate');
  const [error, setError] = useState('');
  const fileRef = useRef<HTMLInputElement>(null);
  const navigate = useNavigate();

  const handleFile = useCallback(async (file: File) => {
    if (file.type !== 'application/pdf') {
      setError('Please upload a PDF file');
      return;
    }
    setError('');
    setIsUploading(true);
    try {
      const result = await uploadPDF(file);
      setUploadedFile({ name: result.filename, chunks: result.chunks, preview: result.preview, numPages: result.numPages });
    } catch {
      setError('Failed to parse PDF. Please try another file.');
    } finally {
      setIsUploading(false);
    }
  }, []);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    const file = e.dataTransfer.files[0];
    if (file) handleFile(file);
  }, [handleFile]);

  const handleGenerate = async () => {
    if (!uploadedFile) return;
    setIsGenerating(true);
    setError('');
    try {
      const scenario = await generateScenario(uploadedFile.chunks, difficulty, uploadedFile.name);
      navigate(`/simulate/${scenario.id}`);
    } catch {
      setError('Failed to generate scenario. Check your API key and try again.');
    } finally {
      setIsGenerating(false);
    }
  };

  return (
    <div className="max-w-4xl mx-auto px-4 py-8">
      {isGenerating && <GeneratingOverlay />}

      <div className="text-center mb-8">
        <h2 className="text-3xl font-bold text-gray-900 mb-2">Create a Patient Scenario</h2>
        <p className="text-gray-600">Upload a nursing PDF and our AI will generate a realistic patient for you to practice with</p>
      </div>

      {/* Drop Zone */}
      <div
        onDragOver={(e) => { e.preventDefault(); setIsDragging(true); }}
        onDragLeave={() => setIsDragging(false)}
        onDrop={handleDrop}
        onClick={() => fileRef.current?.click()}
        className={`border-2 border-dashed rounded-2xl p-12 text-center cursor-pointer transition-all ${
          isDragging ? 'border-medical-blue bg-blue-50 scale-[1.02]' : 'border-gray-300 hover:border-medical-blue hover:bg-gray-50'
        }`}
      >
        <input
          ref={fileRef}
          type="file"
          accept=".pdf"
          className="hidden"
          onChange={(e) => e.target.files?.[0] && handleFile(e.target.files[0])}
        />
        <div className="text-5xl mb-4">
          {isUploading ? '...' : '📄'}
        </div>
        <p className="text-lg font-medium text-gray-700">
          {isUploading ? 'Parsing PDF...' : 'Drop your nursing PDF here or click to browse'}
        </p>
        <p className="text-sm text-gray-500 mt-2">Supports textbooks, case studies, clinical guidelines (max 20MB)</p>
      </div>

      {error && (
        <div className="mt-4 p-4 bg-red-50 border border-red-200 rounded-lg text-red-700">{error}</div>
      )}

      {/* Uploaded File Info */}
      {uploadedFile && (
        <div className="mt-6 bg-white rounded-xl shadow-sm border p-6">
          <h3 className="font-bold text-lg mb-4 text-gray-900">PDF Parsed Successfully</h3>
          <div className="grid grid-cols-3 gap-4 mb-4">
            <div className="bg-gray-50 rounded-lg p-3 text-center">
              <p className="text-2xl font-bold text-medical-blue">{uploadedFile.numPages}</p>
              <p className="text-xs text-gray-500">Pages</p>
            </div>
            <div className="bg-gray-50 rounded-lg p-3 text-center">
              <p className="text-2xl font-bold text-medical-blue">{uploadedFile.chunks.length}</p>
              <p className="text-xs text-gray-500">Content Chunks</p>
            </div>
            <div className="bg-gray-50 rounded-lg p-3 text-center">
              <p className="text-2xl font-bold text-medical-blue">{Math.round(uploadedFile.preview.length / 100)}k</p>
              <p className="text-xs text-gray-500">Characters</p>
            </div>
          </div>

          <div className="mb-4 bg-gray-50 rounded-lg p-4">
            <p className="text-xs font-medium text-gray-500 mb-1">Content Preview</p>
            <p className="text-sm text-gray-700 line-clamp-4">{uploadedFile.preview}</p>
          </div>

          <div className="mb-4">
            <label className="block text-sm font-medium text-gray-700 mb-2">Scenario Difficulty</label>
            <div className="flex gap-2">
              {(['easy', 'moderate', 'hard', 'critical'] as const).map((d) => (
                <button
                  key={d}
                  onClick={() => setDifficulty(d)}
                  className={`px-4 py-2 rounded-lg text-sm font-medium capitalize transition-all ${
                    difficulty === d
                      ? d === 'critical' ? 'bg-red-600 text-white' :
                        d === 'hard' ? 'bg-orange-500 text-white' :
                        d === 'moderate' ? 'bg-yellow-500 text-white' :
                        'bg-green-500 text-white'
                      : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                  }`}
                >
                  {d}
                </button>
              ))}
            </div>
          </div>

          <button onClick={handleGenerate} disabled={isGenerating} className="btn-primary w-full py-3 text-lg">
            {isGenerating ? 'Generating Patient Scenario...' : 'Generate Patient Scenario'}
          </button>
        </div>
      )}
    </div>
  );
}

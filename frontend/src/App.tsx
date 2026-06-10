import { useState, useEffect } from 'react';
import axios from 'axios';

interface RiskAnalysis {
  risk_score: number;
  risk_factors: string[];
  recommendations: string[];
  confidence: number;
}

interface JiraAnalysis {
  release_notes_summary: string;
  risk_score: number;
  risk_factors: string[];
  recommendations: string[];
  confidence: number;
}

interface MetricsData {
  cycle_time_weeks: number;
  on_time_rate: number;
  rollback_rate: number;
  avg_risk_score: number;
  releases_this_month: number;
}

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:8000';

function Dashboard() {
  const [metrics, setMetrics] = useState<MetricsData | null>(null);
  const [backendStatus, setBackendStatus] = useState('connecting...');

  useEffect(() => {
    axios
      .get(`${API_URL}/api/health`)
      .then(() => setBackendStatus('connected'))
      .catch(() => setBackendStatus('backend offline'));

    axios
      .get(`${API_URL}/api/metrics/summary`)
      .then((res) => setMetrics(res.data))
      .catch(() => console.log('Could not load metrics'));
  }, []);

  const getRiskColor = (score: number) => {
    if (score < 1) return 'text-green-600';
    if (score < 2) return 'text-green-500';
    if (score < 3) return 'text-yellow-600';
    if (score < 4) return 'text-orange-600';
    return 'text-red-600';
  };

  return (
    <div className="p-8 max-w-6xl mx-auto">
      <div className="mb-8">
        <h1 className="text-4xl font-bold mb-2">Release Intelligence Dashboard</h1>
        <p className="text-gray-600">
          AI-powered release analysis with Claude API{' '}
          <span className={backendStatus === 'connected' ? 'text-green-600' : 'text-red-600'}>
            ({backendStatus})
          </span>
        </p>
      </div>

      {metrics && (
        <div className="grid grid-cols-1 md:grid-cols-5 gap-4 mb-8">
          <div className="bg-white rounded-lg shadow-md p-6 border-l-4 border-blue-500">
            <p className="text-sm text-gray-600 font-medium">Cycle Time</p>
            <p className="text-3xl font-bold mt-2">{metrics?.cycle_time_weeks?.toFixed(1) ?? '--'}w</p>
            <p className="text-xs text-gray-500 mt-2">weeks to production</p>
          </div>
          <div className="bg-white rounded-lg shadow-md p-6 border-l-4 border-green-500">
            <p className="text-sm text-gray-600 font-medium">On-Time Rate</p>
            <p className="text-3xl font-bold mt-2 text-green-600">{metrics?.on_time_rate != null ? (metrics.on_time_rate * 100).toFixed(0) : '--'}%</p>
            <p className="text-xs text-gray-500 mt-2">releases on schedule</p>
          </div>
          <div className="bg-white rounded-lg shadow-md p-6 border-l-4 border-orange-500">
            <p className="text-sm text-gray-600 font-medium">Avg Risk</p>
            <p className={`text-3xl font-bold mt-2 ${getRiskColor(metrics?.avg_risk_score ?? 0)}`}>
            {metrics?.avg_risk_score?.toFixed(1) ?? '--'}/5
            </p>
            <p className="text-xs text-gray-500 mt-2">average risk score</p>
          </div>
          <div className="bg-white rounded-lg shadow-md p-6 border-l-4 border-red-500">
            <p className="text-sm text-gray-600 font-medium">Rollback Rate</p>
            <p className="text-3xl font-bold mt-2">{metrics?.rollback_rate != null ? (metrics.rollback_rate * 100).toFixed(2) : '--'}%</p>
            <p className="text-xs text-gray-500 mt-2">releases rolled back</p>
          </div>
          <div className="bg-white rounded-lg shadow-md p-6 border-l-4 border-purple-500">
            <p className="text-sm text-gray-600 font-medium">This Month</p>
            <p className="text-3xl font-bold mt-2">{metrics.releases_this_month}</p>
            <p className="text-xs text-gray-500 mt-2">releases shipped</p>
          </div>
        </div>
      )}

      <div className="bg-blue-50 border border-blue-200 rounded-lg p-6">
        <h2 className="text-lg font-semibold text-blue-900 mb-3">Getting Started</h2>
        <ol className="space-y-2 text-blue-800">
          <li>1. Go to the <strong>Analyzer</strong> tab to manually enter release notes (Phase 1)</li>
          <li>2. Go to the <strong>Jira Analyzer</strong> tab to auto-fetch from Jira using a Version ID (Phase 2)</li>
          <li>3. Claude API analyzes the release in real-time and predicts deployment risk</li>
        </ol>
      </div>
    </div>
  );
}

function ReleaseAnalyzer() {
  const [releaseNotes, setReleaseNotes] = useState('');
  const [testCoverage, setTestCoverage] = useState(85);
  const [depsChanged, setDepsChanged] = useState(2);
  const [analysis, setAnalysis] = useState<RiskAnalysis | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const handleAnalyze = async () => {
    setLoading(true);
    setError('');
    setAnalysis(null);

    try {
      const response = await axios.post(`${API_URL}/api/analysis/analyze`, {
        release_notes: releaseNotes,
        test_coverage: testCoverage,
        dependencies_changed: depsChanged,
      });

      if (response.data.success) {
        setAnalysis(response.data.data);
      }
    } catch (err) {
      const errorMsg = axios.isAxiosError(err)
        ? err.response?.data?.detail || err.message
        : 'Analysis failed';
      setError(`Error: ${errorMsg}`);
    } finally {
      setLoading(false);
    }
  };

  const getRiskColor = (score: number) => {
    if (score < 1) return '#22c55e';
    if (score < 2) return '#84cc16';
    if (score < 3) return '#eab308';
    if (score < 4) return '#f97316';
    return '#ef4444';
  };

  const getRiskLabel = (score: number) => {
    if (score < 1) return 'Very Safe';
    if (score < 2) return 'Safe';
    if (score < 3) return 'Moderate';
    if (score < 4) return 'High Risk';
    return 'Critical';
  };

  return (
    <div className="p-8 max-w-4xl mx-auto">
      <div className="mb-8">
        <div className="inline-block bg-blue-100 text-blue-800 text-xs font-semibold px-3 py-1 rounded-full mb-3">
          Phase 1 — Manual Input
        </div>
        <h1 className="text-4xl font-bold mb-2">Release Analyzer</h1>
        <p className="text-gray-600">
          Paste your release notes manually and get AI-powered risk analysis powered by Claude
        </p>
      </div>

      <div className="bg-white rounded-lg shadow-lg p-8 mb-8">
        <div className="mb-6">
          <label className="block mb-3">
            <span className="text-lg font-semibold text-gray-800">Release Notes</span>
            <p className="text-sm text-gray-500 mt-1">Paste changelog, commit messages, or release summary</p>
          </label>
          <textarea
            value={releaseNotes}
            onChange={(e) => setReleaseNotes(e.target.value)}
            placeholder="Example: Updated Java 8 security patches (CVE-2024-12345), fixed performance regression in GC, added TLS 1.3 support..."
            className="w-full h-40 p-4 border-2 border-gray-200 rounded-lg font-mono text-sm focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500"
          />
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-6">
          <div>
            <label className="block mb-3">
              <span className="text-lg font-semibold text-gray-800">Test Coverage</span>
              <p className="text-sm text-gray-500 mt-1">Percentage of code covered by tests</p>
            </label>
            <div className="flex items-center gap-4">
              <input
                type="range"
                min="0"
                max="100"
                value={testCoverage}
                onChange={(e) => setTestCoverage(Number(e.target.value))}
                className="flex-1 h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer"
              />
              <span className="text-3xl font-bold text-blue-600 min-w-12">{testCoverage}%</span>
            </div>
          </div>

          <div>
            <label className="block mb-3">
              <span className="text-lg font-semibold text-gray-800">Dependencies Changed</span>
              <p className="text-sm text-gray-500 mt-1">Number of dependency updates</p>
            </label>
            <input
              type="number"
              min="0"
              max="100"
              value={depsChanged}
              onChange={(e) => setDepsChanged(Math.max(0, Number(e.target.value)))}
              className="w-full px-4 py-3 text-lg border-2 border-gray-200 rounded-lg focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500"
            />
          </div>
        </div>

        <button
          onClick={handleAnalyze}
          disabled={loading || !releaseNotes.trim()}
          className={`w-full py-4 px-6 text-lg font-bold rounded-lg transition-all ${
            loading || !releaseNotes.trim()
              ? 'bg-gray-300 text-gray-500 cursor-not-allowed'
              : 'bg-blue-600 text-white hover:bg-blue-700 active:scale-95'
          }`}
        >
          {loading ? '🤔 Analyzing with Claude API...' : '🚀 Analyze Release'}
        </button>
      </div>

      {error && (
        <div className="bg-red-50 border-l-4 border-red-500 p-6 mb-8 rounded-lg">
          <p className="text-red-800 font-semibold">Analysis Error</p>
          <p className="text-red-700 mt-1">{error}</p>
        </div>
      )}

      {analysis && (
        <div className="space-y-6">
          <div className="bg-white rounded-lg shadow-lg p-8">
            <h2 className="text-2xl font-bold mb-6">Analysis Results</h2>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-8 mb-8">
              <div>
                <p className="text-sm text-gray-600 font-medium uppercase tracking-wide">Risk Score</p>
                <div className="mt-4 flex items-end gap-4">
                  <div
                    className="w-24 h-24 rounded-full flex items-center justify-center text-white font-bold text-4xl"
                    style={{ backgroundColor: getRiskColor(analysis.risk_score) }}
                  >
                    {analysis.risk_score.toFixed(1)}
                  </div>
                  <div>
                    <p className="text-3xl font-bold" style={{ color: getRiskColor(analysis.risk_score) }}>
                      {getRiskLabel(analysis.risk_score)}
                    </p>
                    <p className="text-sm text-gray-600 mt-2">out of 5.0</p>
                  </div>
                </div>
              </div>
              <div className="bg-gray-50 rounded-lg p-6">
                <p className="text-sm text-gray-600 font-medium uppercase tracking-wide">Confidence</p>
                <div className="mt-4">
                  <p className="text-3xl font-bold text-gray-800">{(analysis.confidence * 100).toFixed(0)}%</p>
                  <div className="mt-4 w-full bg-gray-200 rounded-full h-2">
                    <div
                      className="bg-blue-600 h-2 rounded-full"
                      style={{ width: `${analysis.confidence * 100}%` }}
                    />
                  </div>
                  <p className="text-sm text-gray-600 mt-3">How confident Claude is in this assessment</p>
                </div>
              </div>
            </div>

            <div className="mb-8">
              <h3 className="text-xl font-bold mb-4 flex items-center gap-2">
                <span className="text-red-600">⚠️</span> Risk Factors
              </h3>
              <div className="space-y-3">
                {analysis.risk_factors.length > 0 ? (
                  analysis.risk_factors.map((factor, i) => (
                    <div key={i} className="bg-red-50 border-l-4 border-red-500 p-4 rounded">
                      <p className="text-red-900 font-medium">{factor}</p>
                    </div>
                  ))
                ) : (
                  <p className="text-gray-600 italic">No major risk factors identified.</p>
                )}
              </div>
            </div>

            <div>
              <h3 className="text-xl font-bold mb-4 flex items-center gap-2">
                <span className="text-green-600">✓</span> Recommendations
              </h3>
              <div className="space-y-3">
                {analysis.recommendations.length > 0 ? (
                  analysis.recommendations.map((rec, i) => (
                    <div key={i} className="bg-green-50 border-l-4 border-green-500 p-4 rounded">
                      <p className="text-green-900 font-medium">{rec}</p>
                    </div>
                  ))
                ) : (
                  <p className="text-gray-600 italic">No specific recommendations at this time.</p>
                )}
              </div>
            </div>
          </div>

          <div className="bg-blue-50 border border-blue-200 rounded-lg p-6">
            <h3 className="font-semibold text-blue-900 mb-3">How to interpret this score:</h3>
            <ul className="space-y-2 text-sm text-blue-800">
              <li><strong>0-1 (Very Safe):</strong> Minimal risk. Deploy with standard procedures.</li>
              <li><strong>1-2 (Safe):</strong> Low risk. Routine deployment process appropriate.</li>
              <li><strong>2-3 (Moderate):</strong> Some risk. Recommend extra monitoring and gradual rollout.</li>
              <li><strong>3-4 (High Risk):</strong> Significant risk. Consider delaying or adding more testing.</li>
              <li><strong>4-5 (Critical):</strong> Do not ship. Address risk factors before deployment.</li>
            </ul>
          </div>
        </div>
      )}
    </div>
  );
}

function JiraAnalyzer() {
  const [versionName, setVersionName] = useState('');
  const [projectKey, setProjectKey] = useState('RAD');
  const [testCoverage, setTestCoverage] = useState(75);
  const [analysis, setAnalysis] = useState<JiraAnalysis | null>(null);
  const [issuesFetched, setIssuesFetched] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const handleAnalyze = async () => {
    setLoading(true);
    setError('');
    setAnalysis(null);
    setIssuesFetched('');

    try {
      const response = await axios.post(`${API_URL}/api/analysis/analyze-jira`, {
        version_name: versionName,
        project_key: projectKey,
        test_coverage: testCoverage,
      });

      if (response.data.success) {
        setAnalysis(response.data.data);
        setIssuesFetched(response.data.issues_fetched);
      }
    } catch (err) {
      const errorMsg = axios.isAxiosError(err)
        ? err.response?.data?.detail || err.message
        : 'Analysis failed';
      setError(`Error: ${errorMsg}`);
    } finally {
      setLoading(false);
    }
  };

  const getRiskColor = (score: number) => {
    if (score < 1) return '#22c55e';
    if (score < 2) return '#84cc16';
    if (score < 3) return '#eab308';
    if (score < 4) return '#f97316';
    return '#ef4444';
  };

  const getRiskLabel = (score: number) => {
    if (score < 1) return 'Very Safe';
    if (score < 2) return 'Safe';
    if (score < 3) return 'Moderate';
    if (score < 4) return 'High Risk';
    return 'Critical';
  };

  return (
    <div className="p-8 max-w-4xl mx-auto">
      <div className="mb-8">
        <div className="inline-block bg-purple-100 text-purple-800 text-xs font-semibold px-3 py-1 rounded-full mb-3">
          Phase 2 — Jira Integration
        </div>
        <h1 className="text-4xl font-bold mb-2">Jira Release Analyzer</h1>
        <p className="text-gray-600">
          Enter a Jira Version ID — release notes are auto-fetched from Jira. No manual input needed.
        </p>
      </div>

      {/* How it works banner */}
      <div className="bg-purple-50 border border-purple-200 rounded-lg p-5 mb-8">
        <h3 className="font-semibold text-purple-900 mb-2">How Phase 2 works</h3>
        <ol className="space-y-1 text-sm text-purple-800">
          <li>1. You enter a Jira Version ID below</li>
          <li>2. FastAPI calls the Jira REST API and fetches all issues for that version</li>
          <li>3. Claude receives the raw issues and generates release notes + risk analysis in one call</li>
          <li>4. No manual copy-paste needed — Jira is the source of truth</li>
        </ol>
      </div>

      <div className="bg-white rounded-lg shadow-lg p-8 mb-8">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-6">
          <div>
            <label className="block mb-3">
              <span className="text-lg font-semibold text-gray-800">Jira Version Name</span>
              <p className="text-sm text-gray-500 mt-1">The Fix Version name from your Jira project</p>
            </label>
            <input
              type="text"
              value={versionName}
              onChange={(e) => setVersionName(e.target.value)}
              placeholder="e.g. Java-CPU-Jan-2025"
              className="w-full px-4 py-3 text-lg border-2 border-gray-200 rounded-lg focus:outline-none focus:border-purple-500 focus:ring-1 focus:ring-purple-500"
            />
          </div>

          <div>
            <label className="block mb-3">
              <span className="text-lg font-semibold text-gray-800">Project Key</span>
              <p className="text-sm text-gray-500 mt-1">Jira project key (e.g. RAD)</p>
            </label>
            <input
              type="text"
              value={projectKey}
              onChange={(e) => setProjectKey(e.target.value)}
              placeholder="RAD"
              className="w-full px-4 py-3 text-lg border-2 border-gray-200 rounded-lg focus:outline-none focus:border-purple-500 focus:ring-1 focus:ring-purple-500"
            />
          </div>
        </div>

        <div className="mb-6">
          <label className="block mb-3">
            <span className="text-lg font-semibold text-gray-800">Test Coverage</span>
            <p className="text-sm text-gray-500 mt-1">Percentage of code covered by tests (manual input — not yet available from Jira)</p>
          </label>
          <div className="flex items-center gap-4">
            <input
              type="range"
              min="0"
              max="100"
              value={testCoverage}
              onChange={(e) => setTestCoverage(Number(e.target.value))}
              className="flex-1 h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer"
            />
            <span className="text-3xl font-bold text-purple-600 min-w-12">{testCoverage}%</span>
          </div>
        </div>

        <button
          onClick={handleAnalyze}
          disabled={loading || !versionName.trim()}
          className={`w-full py-4 px-6 text-lg font-bold rounded-lg transition-all ${
            loading || !versionName.trim()
              ? 'bg-gray-300 text-gray-500 cursor-not-allowed'
              : 'bg-purple-600 text-white hover:bg-purple-700 active:scale-95'
          }`}
        >
          {loading ? '⏳ Fetching from Jira & Analyzing...' : '🔗 Fetch from Jira & Analyze'}
        </button>
      </div>

      {error && (
        <div className="bg-red-50 border-l-4 border-red-500 p-6 mb-8 rounded-lg">
          <p className="text-red-800 font-semibold">Analysis Error</p>
          <p className="text-red-700 mt-1">{error}</p>
        </div>
      )}

      {issuesFetched && (
        <div className="bg-gray-50 border border-gray-200 rounded-lg p-6 mb-6">
          <h3 className="font-semibold text-gray-700 mb-3">📋 Issues Fetched from Jira</h3>
          <pre className="text-sm text-gray-600 whitespace-pre-wrap font-mono">{issuesFetched}</pre>
        </div>
      )}

      {analysis && (
        <div className="space-y-6">
          {analysis.release_notes_summary && (
            <div className="bg-purple-50 border border-purple-200 rounded-lg p-6">
              <h3 className="font-semibold text-purple-900 mb-2">📝 Release Notes Summary (AI Generated)</h3>
              <p className="text-purple-800">{analysis.release_notes_summary}</p>
            </div>
          )}

          <div className="bg-white rounded-lg shadow-lg p-8">
            <h2 className="text-2xl font-bold mb-6">Risk Analysis</h2>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-8 mb-8">
              <div>
                <p className="text-sm text-gray-600 font-medium uppercase tracking-wide">Risk Score</p>
                <div className="mt-4 flex items-end gap-4">
                  <div
                    className="w-24 h-24 rounded-full flex items-center justify-center text-white font-bold text-4xl"
                    style={{ backgroundColor: getRiskColor(analysis.risk_score) }}
                  >
                    {analysis.risk_score.toFixed(1)}
                  </div>
                  <div>
                    <p className="text-3xl font-bold" style={{ color: getRiskColor(analysis.risk_score) }}>
                      {getRiskLabel(analysis.risk_score)}
                    </p>
                    <p className="text-sm text-gray-600 mt-2">out of 5.0</p>
                  </div>
                </div>
              </div>
              <div className="bg-gray-50 rounded-lg p-6">
                <p className="text-sm text-gray-600 font-medium uppercase tracking-wide">Confidence</p>
                <div className="mt-4">
                  <p className="text-3xl font-bold text-gray-800">{(analysis.confidence * 100).toFixed(0)}%</p>
                  <div className="mt-4 w-full bg-gray-200 rounded-full h-2">
                    <div
                      className="bg-purple-600 h-2 rounded-full"
                      style={{ width: `${analysis.confidence * 100}%` }}
                    />
                  </div>
                  <p className="text-sm text-gray-600 mt-3">How confident Claude is in this assessment</p>
                </div>
              </div>
            </div>

            <div className="mb-8">
              <h3 className="text-xl font-bold mb-4 flex items-center gap-2">
                <span className="text-red-600">⚠️</span> Risk Factors
              </h3>
              <div className="space-y-3">
                {analysis.risk_factors.length > 0 ? (
                  analysis.risk_factors.map((factor, i) => (
                    <div key={i} className="bg-red-50 border-l-4 border-red-500 p-4 rounded">
                      <p className="text-red-900 font-medium">{factor}</p>
                    </div>
                  ))
                ) : (
                  <p className="text-gray-600 italic">No major risk factors identified.</p>
                )}
              </div>
            </div>

            <div>
              <h3 className="text-xl font-bold mb-4 flex items-center gap-2">
                <span className="text-green-600">✓</span> Recommendations
              </h3>
              <div className="space-y-3">
                {analysis.recommendations.length > 0 ? (
                  analysis.recommendations.map((rec, i) => (
                    <div key={i} className="bg-green-50 border-l-4 border-green-500 p-4 rounded">
                      <p className="text-green-900 font-medium">{rec}</p>
                    </div>
                  ))
                ) : (
                  <p className="text-gray-600 italic">No specific recommendations at this time.</p>
                )}
              </div>
            </div>
          </div>
        
        
          <div className="bg-blue-50 border border-blue-200 rounded-lg p-6">
            <h3 className="font-semibold text-blue-900 mb-3">How to interpret this score:</h3>
            <ul className="space-y-2 text-sm text-blue-800">
              <li><strong>0-1 (Very Safe):</strong> Minimal risk. Deploy with standard procedures.</li>
              <li><strong>1-2 (Safe):</strong> Low risk. Routine deployment process appropriate.</li>
              <li><strong>2-3 (Moderate):</strong> Some risk. Recommend extra monitoring and gradual rollout.</li>
              <li><strong>3-4 (High Risk):</strong> Significant risk. Consider delaying or adding more testing.</li>
              <li><strong>4-5 (Critical):</strong> Do not ship. Address risk factors before deployment.</li>
            </ul>
          </div>
        </div>
      )}
    </div>
  );
}

export default function App() {
  const [currentPage, setCurrentPage] = useState<'dashboard' | 'analyzer' | 'jira'>('analyzer');

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-50 to-gray-100">
      <nav className="bg-slate-900 text-white shadow-lg">
        <div className="max-w-7xl mx-auto px-6 py-4 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className="text-2xl">🚀</span>
            <h1 className="text-xl font-bold">Release Intelligence</h1>
          </div>
          <div className="flex gap-2">
            <button
              onClick={() => setCurrentPage('dashboard')}
              className={`px-6 py-2 rounded-lg font-medium transition-all ${
                currentPage === 'dashboard'
                  ? 'bg-blue-600 text-white'
                  : 'bg-slate-700 text-gray-200 hover:bg-slate-600'
              }`}
            >
              Dashboard
            </button>
            <button
              onClick={() => setCurrentPage('analyzer')}
              className={`px-6 py-2 rounded-lg font-medium transition-all ${
                currentPage === 'analyzer'
                  ? 'bg-blue-600 text-white'
                  : 'bg-slate-700 text-gray-200 hover:bg-slate-600'
              }`}
            >
              Analyzer
            </button>
            <button
              onClick={() => setCurrentPage('jira')}
              className={`px-6 py-2 rounded-lg font-medium transition-all ${
                currentPage === 'jira'
                  ? 'bg-purple-600 text-white'
                  : 'bg-slate-700 text-gray-200 hover:bg-slate-600'
              }`}
            >
              Jira Analyzer ✨
            </button>
          </div>
        </div>
      </nav>

      <div className="min-h-screen">
        {currentPage === 'dashboard' && <Dashboard />}
        {currentPage === 'analyzer' && <ReleaseAnalyzer />}
        {currentPage === 'jira' && <JiraAnalyzer />}
      </div>

      <footer className="bg-slate-900 text-gray-400 text-center py-4 mt-12">
        <p>Release Intelligence Dashboard • Powered by Claude API • Built for TPMs</p>
      </footer>
    </div>
  );
}

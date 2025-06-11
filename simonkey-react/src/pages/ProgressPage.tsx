// src/pages/ProgressPage.tsx
import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { collection, query, where, getDocs } from 'firebase/firestore';
import { db, auth } from '../services/firebase';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, PieChart, Pie, Cell } from 'recharts';
import '../styles/ProgressPage.css';
import { Concept } from '../types/interfaces';


// Define interfaces for your types
interface StatsType {
  totalConcepts: number;
  masteredConcepts: number;
  notebooks: number;
  studyTime: number;
}

interface ActivityDataPoint {
  name: string;
  conceptos: number;
  tiempo: number;
}

interface NotebookDataPoint {
  name: string;
  conceptos: number;
  dominados: number;
}

interface ConceptsByNotebookItem {
  name: string;
  value: number;
  color: string;
}

interface NotebookType {
  id: string;
  title: string;
  color: string;
}

// We can make this more specific if needed, but for simplicity let's use these interfaces
interface TooltipProps {
  active?: boolean;
  payload?: any[];
  label?: string;
}

const ProgressPage = () => {
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const [stats, setStats] = useState<StatsType>({
    totalConcepts: 0,
    masteredConcepts: 0,
    notebooks: 0,
    studyTime: 0
  });
  const [selectedPeriod, setSelectedPeriod] = useState<'week' | 'month'>('week');
  const [activityData, setActivityData] = useState<ActivityDataPoint[]>([]);
  const [, setNotebookData] = useState<NotebookDataPoint[]>([]);
  const [conceptsByNotebook, setConceptsByNotebook] = useState<ConceptsByNotebookItem[]>([]);
  const navigate = useNavigate();

  // Colors for charts
  const COLORS = ['#6147FF', '#FF6B6B', '#4CAF50', '#FFC107', '#03A9F4', '#9C27B0'];

  useEffect(() => {
    const fetchProgressData = async () => {
      if (!auth.currentUser) {
        navigate('/login');
        return;
      }
      
      try {
        setLoading(true);
        setError(null);
        
        // Get user's notebooks
        const notebooksQuery = query(
          collection(db, 'notebooks'),
          where('userId', '==', auth.currentUser.uid)
        );
        
        const notebooksSnapshot = await getDocs(notebooksQuery);
        const notebooks = notebooksSnapshot.docs.map(doc => ({
          id: doc.id,
          title: doc.data().title,
          color: doc.data().color || '#6147FF'
        })) as NotebookType[];
        
        // Get concepts by notebook
        let totalConcepts = 0;
        let masteredConcepts = 0;
        let conceptsDistribution: ConceptsByNotebookItem[] = [];
        
        for (const notebook of notebooks) {
          const conceptsQuery = query(
            collection(db, 'conceptos'),
            where('cuadernoId', '==', notebook.id)
          );
          
          const conceptsSnapshot = await getDocs(conceptsQuery);
          let notebookConceptsCount = 0;
          
          conceptsSnapshot.docs.forEach(doc => {
            const conceptos = doc.data().conceptos as Concept[] || [];
            notebookConceptsCount += conceptos.length;
            
            conceptos.forEach((concepto: Concept) => {
              if (concepto.dominado) {
                masteredConcepts++;
              }
            });
          });
          
          totalConcepts += notebookConceptsCount;
          
          if (notebookConceptsCount > 0) {
            conceptsDistribution.push({
              name: notebook.title,
              value: notebookConceptsCount,
              color: notebook.color
            });
          }
        }
        
        setConceptsByNotebook(conceptsDistribution);
        
        // In a real app, this data would come from an activity or stats collection
        // Here we're simulating data for the demo
        setStats({
          totalConcepts,
          masteredConcepts,
          notebooks: notebooks.length,
          studyTime: Math.floor(Math.random() * 500) + 100 // Minutes (simulated)
        });
        
        // Generate simulated activity data for the chart
        generateActivityData(selectedPeriod);
        
        // Generate notebook evolution data
        generateNotebookData();
        
      } catch (error) {
        console.error("Error loading progress data:", error);
        setError("Failed to load progress data. Please try again later.");
      } finally {
        setLoading(false);
      }
    };
    
    fetchProgressData();
  }, [selectedPeriod, navigate]);

  // Generate activity data for the chart (simulated)
  const generateActivityData = (period: 'week' | 'month') => {
    let data: ActivityDataPoint[] = [];
    
    if (period === 'week') {
      // Data for the last week
      const days = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
      
      data = days.map(day => ({
        name: day,
        conceptos: Math.floor(Math.random() * 15),
        tiempo: Math.floor(Math.random() * 60) + 10
      }));
    } else if (period === 'month') {
      // Data for the last month
      data = Array(4).fill(0).map((_, i) => ({
        name: `Week ${i + 1}`,
        conceptos: Math.floor(Math.random() * 40) + 20,
        tiempo: Math.floor(Math.random() * 200) + 60
      }));
    }
    
    setActivityData(data);
  };

  // Generate simulated notebook evolution data
  const generateNotebookData = () => {
    const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun'];
    
    const data: NotebookDataPoint[] = months.map((month, index) => {
      const conceptos = Math.floor((index + 1) * 15 + Math.random() * 10);
      return {
        name: month,
        conceptos: conceptos,
        dominados: Math.floor(conceptos * (0.4 + Math.random() * 0.3))
      };
    });
    
    setNotebookData(data);
  };

  // Change visualization period
  const handlePeriodChange = (period: 'week' | 'month') => {
    setSelectedPeriod(period);
  };

  // Format time for display
  const formatStudyTime = (minutes: number): string => {
    const hours = Math.floor(minutes / 60);
    const mins = minutes % 60;
    
    if (hours > 0) {
      return `${hours}h ${mins > 0 ? `${mins}m` : ''}`;
    }
    
    return `${mins}m`;
  };

  // Calculate overall progress
  const calculateProgress = (): number => {
    if (stats.totalConcepts === 0) return 0;
    return Math.round((stats.masteredConcepts / stats.totalConcepts) * 100);
  };

  // Render custom tooltip for line chart
  const CustomTooltip = ({ active, payload, label }: TooltipProps) => {
    if (active && payload && payload.length) {
      return (
        <div className="custom-tooltip">
          <p className="tooltip-label">{`${label}`}</p>
          <p className="tooltip-value">
            <span style={{ color: '#6147FF' }}>Concepts: {payload[0].value}</span>
          </p>
          <p className="tooltip-value">
            <span style={{ color: '#FF6B6B' }}>Time: {payload[1].value} min</span>
          </p>
        </div>
      );
    }
  
    return null;
  };

  // Render custom tooltip for pie chart
  const PieTooltip = ({ active, payload }: TooltipProps) => {
    if (active && payload && payload.length) {
      return (
        <div className="custom-tooltip">
          <p className="tooltip-label">{`${payload[0].name}`}</p>
          <p className="tooltip-value">
            <span style={{ color: payload[0].payload.color }}>
              {payload[0].value} concepts ({Math.round((payload[0].value / stats.totalConcepts) * 100)}%)
            </span>
          </p>
        </div>
      );
    }
  
    return null;
  };

  if (loading) {
    return (
      <div className="progress-page-container">
        <div className="loading-container">
          <div className="spinner"></div>
          <p>Loading progress data...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="progress-page-container">
        <div className="error-container">
          <i className="fas fa-exclamation-circle"></i>
          <p>{error}</p>
          <button onClick={() => window.location.reload()}>Try Again</button>
        </div>
      </div>
    );
  }

  return (
    <div className="progress-page-container">
      <header className="progress-page-header">
        <div className="header-content">
          <button 
            className="back-button"
            onClick={() => navigate('/notebooks')}
          >
            <i className="fas fa-arrow-left"></i>
          </button>
          
          <h1>My Progress</h1>
          
          <div className="header-spacer"></div>
        </div>
      </header>
      
      <main className="progress-page-main">
        <section className="progress-summary">
          <div className="summary-card">
            <div className="summary-icon concepts">
              <i className="fas fa-book"></i>
            </div>
            <div className="summary-content">
              <div className="summary-value">{stats.totalConcepts}</div>
              <div className="summary-label">Concepts</div>
            </div>
          </div>
          
          <div className="summary-card">
            <div className="summary-icon mastery">
              <i className="fas fa-graduation-cap"></i>
            </div>
            <div className="summary-content">
              <div className="summary-value">{calculateProgress()}%</div>
              <div className="summary-label">Overall Progress</div>
            </div>
          </div>
          
          <div className="summary-card">
            <div className="summary-icon time">
              <i className="fas fa-clock"></i>
            </div>
            <div className="summary-content">
              <div className="summary-value">{formatStudyTime(stats.studyTime)}</div>
              <div className="summary-label">Study Time</div>
            </div>
          </div>
        </section>
        
        <section className="progress-charts">
          <div className="chart-container activity-chart">
            <div className="chart-header">
              <h2>Study Activity</h2>
              <div className="period-selector">
                <button
                  className={selectedPeriod === 'week' ? 'active' : ''}
                  onClick={() => handlePeriodChange('week')}
                >
                  Week
                </button>
                <button
                  className={selectedPeriod === 'month' ? 'active' : ''}
                  onClick={() => handlePeriodChange('month')}
                >
                  Month
                </button>
              </div>
            </div>
            
            <div className="chart-content">
              <ResponsiveContainer width="100%" height={300}>
                <LineChart
                  data={activityData}
                  margin={{ top: 10, right: 10, left: 0, bottom: 20 }}
                >
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="name" />
                  <YAxis yAxisId="left" />
                  <YAxis yAxisId="right" orientation="right" />
                  <Tooltip content={<CustomTooltip />} />
                  <Legend />
                  <Line
                    yAxisId="left"
                    type="monotone"
                    dataKey="conceptos"
                    stroke="#6147FF"
                    strokeWidth={2}
                    activeDot={{ r: 8 }}
                    name="Studied Concepts"
                  />
                  <Line
                    yAxisId="right"
                    type="monotone"
                    dataKey="tiempo"
                    stroke="#FF6B6B"
                    strokeWidth={2}
                    name="Time (min)"
                  />
                </LineChart>
              </ResponsiveContainer>
            </div>
          </div>
          
          <div className="chart-container pie-chart">
            <div className="chart-header">
              <h2>Distribution by Notebook</h2>
            </div>
            
            <div className="chart-content">
              {conceptsByNotebook.length > 0 ? (
                <ResponsiveContainer width="100%" height={300}>
                  <PieChart>
                    <Pie
                      data={conceptsByNotebook}
                      cx="50%"
                      cy="50%"
                      innerRadius={60}
                      outerRadius={80}
                      paddingAngle={5}
                      dataKey="value"
                      label={({name, percent}) => `${name} (${(percent * 100).toFixed(0)}%)`}
                    >
                      {conceptsByNotebook.map((entry, index) => (
                        <Cell key={`cell-${index}`} fill={entry.color || COLORS[index % COLORS.length]} />
                      ))}
                    </Pie>
                    <Tooltip content={<PieTooltip />} />
                  </PieChart>
                </ResponsiveContainer>
              ) : (
                <div className="empty-chart">
                  <p>Not enough data to display</p>
                </div>
              )}
            </div>
          </div>
        </section>
        
        <section className="progress-insights">
          <div className="insight-card">
            <div className="insight-icon">
              <i className="fas fa-lightbulb"></i>
            </div>
            <div className="insight-content">
              <h3>Your Best Study Days</h3>
              <p>Your most productive days are <strong>Tuesday and Thursday</strong>. Schedule important sessions on these days to maximize your performance.</p>
            </div>
          </div>
          
          <div className="insight-card">
            <div className="insight-icon">
              <i className="fas fa-star"></i>
            </div>
            <div className="insight-content">
              <h3>Next Achievement</h3>
              <p>You're just 5 concepts away from reaching your <strong>"Dedicated Scholar"</strong> achievement!</p>
            </div>
          </div>
        </section>
      </main>
    </div>
  );
};

export default ProgressPage;
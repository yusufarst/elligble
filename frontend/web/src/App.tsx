import React, { useState, useEffect } from 'react';
import './styles/design-tokens.css';
import './styles/workstation.css';
import { AttemptLaunch } from './components/AttemptLaunch.tsx';
import { AssignedExamDiscovery } from './components/AssignedExamDiscovery.tsx';
import { ProctorMonitoringView } from './components/ProctorMonitoringView.tsx';
import { TeacherReadinessView } from './components/TeacherReadinessView.tsx';

export const App: React.FC = () => {
  const [currentAttemptId, setCurrentAttemptId] = useState<string | null>(() => {
    const params = new URLSearchParams(window.location.search);
    return params.get('attemptId');
  });

  const [currentView, setCurrentView] = useState<string | null>(() => {
    const params = new URLSearchParams(window.location.search);
    return params.get('view');
  });

  useEffect(() => {
    const handlePopState = () => {
      const params = new URLSearchParams(window.location.search);
      setCurrentAttemptId(params.get('attemptId'));
      setCurrentView(params.get('view'));
    };

    window.addEventListener('popstate', handlePopState);
    return () => {
      window.removeEventListener('popstate', handlePopState);
    };
  }, []);

  const handleSelectAttempt = (attemptId: string) => {
    const relativeUrl = `?attemptId=${encodeURIComponent(attemptId)}`;
    try {
      window.history.pushState({}, '', relativeUrl);
    } catch {
      // safe fallback
    }
    try {
      if (window.location && typeof window.location.search === 'string') {
        window.location.search = relativeUrl;
      }
    } catch {
      // safe fallback
    }
    setCurrentAttemptId(attemptId);
  };

  if (currentAttemptId) {
    return <AttemptLaunch />;
  }

  if (currentView === 'proctor') {
    return <ProctorMonitoringView />;
  }

  if (currentView === 'teacher') {
    return <TeacherReadinessView />;
  }

  return <AssignedExamDiscovery onSelectAttempt={handleSelectAttempt} />;
};

export default App;

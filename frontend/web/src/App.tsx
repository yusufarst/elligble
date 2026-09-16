import React, { useState, useEffect } from 'react';
import './styles/design-tokens.css';
import './styles/workstation.css';
import { AttemptLaunch } from './components/AttemptLaunch.tsx';
import { AssignedExamDiscovery } from './components/AssignedExamDiscovery.tsx';

export const App: React.FC = () => {
  const [currentAttemptId, setCurrentAttemptId] = useState<string | null>(() => {
    const params = new URLSearchParams(window.location.search);
    return params.get('attemptId');
  });

  useEffect(() => {
    const handlePopState = () => {
      const params = new URLSearchParams(window.location.search);
      setCurrentAttemptId(params.get('attemptId'));
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

  return <AssignedExamDiscovery onSelectAttempt={handleSelectAttempt} />;
};

export default App;

import { Routes, Route } from 'react-router-dom';
import { ProblemListPage } from './pages/ProblemListPage';
import { ProblemDetailPage } from './pages/ProblemDetailPage';
import { AttemptResultPage } from './pages/AttemptResultPage';
import { LearnerHistoryPage } from './pages/LearnerHistoryPage';

function App() {
  return (
    <Routes>
      <Route path="/" element={<ProblemListPage />} />
      <Route path="/problems/:id" element={<ProblemDetailPage />} />
      <Route path="/attempts/:id" element={<AttemptResultPage />} />
      <Route path="/learners/:id/history" element={<LearnerHistoryPage />} />
    </Routes>
  );
}

export default App;

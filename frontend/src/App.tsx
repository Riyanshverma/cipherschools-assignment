import { Routes, Route } from 'react-router-dom';
import { ProblemList } from './screens/ProblemList';
import { ProblemDetail } from './screens/ProblemDetail';
import { Result } from './screens/Result';
import { LearnerHistoryPage } from './pages/LearnerHistoryPage';

function App() {
  return (
    <Routes>
      <Route path="/" element={<ProblemList />} />
      <Route path="/problems/:id" element={<ProblemDetail />} />
      <Route path="/attempts/:id" element={<Result />} />
      <Route path="/learners/:id/history" element={<LearnerHistoryPage />} />
    </Routes>
  );
}

export default App;

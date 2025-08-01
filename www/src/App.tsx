import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';
import { Layout } from '@/components/Layout';
import { TransactionList } from '@/components/TransactionList';
import { TransactionDetail } from '@/components/TransactionDetail';
import { SeekTransaction } from '@/components/SeekTransaction';
import { ComparisonProvider } from './context/ComparisonContext';

function App() {
  return (
    <Router>
      <ComparisonProvider>
        <Layout>
          <Routes>
            <Route path="/" element={<TransactionList />} />
            <Route path="/seek" element={<SeekTransaction />} />
            <Route path="/transaction/:id" element={<TransactionDetail />} />
          </Routes>
        </Layout>
      </ComparisonProvider>
    </Router>
  );
}

export default App;
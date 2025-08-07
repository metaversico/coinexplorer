import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';
import { Layout } from '@/components/Layout';
import { TransactionList } from '@/components/TransactionList';
import { TransactionDetail } from '@/components/TransactionDetail';
import { RpcRequestList } from '@/components/RpcRequestList';
import { RpcRequestDetail } from '@/components/RpcRequestDetail';
import { SeekTransaction } from '@/components/SeekTransaction';
import { MarketList } from '@/components/MarketList';
import { MarketDetail } from '@/components/MarketDetail';
import { ComparisonProvider } from './context/ComparisonContext';

function App() {
  return (
    <Router>
      <ComparisonProvider>
        <Layout>
          <Routes>
            <Route path="/" element={<TransactionList />} />
            <Route path="/markets" element={<MarketList />} />
            <Route path="/market/:address" element={<MarketDetail />} />
            <Route path="/seek" element={<SeekTransaction />} />
            <Route path="/transaction/:id" element={<TransactionDetail />} />
            <Route path="/rpc-requests" element={<RpcRequestList />} />
            <Route path="/rpc-request/:id" element={<RpcRequestDetail />} />
          </Routes>
        </Layout>
      </ComparisonProvider>
    </Router>
  );
}

export default App;
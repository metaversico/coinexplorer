import React from 'react';
import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';
import { Layout } from '@/components/Layout';
import { TransactionList } from '@/components/TransactionList';
import { TransactionDetail } from '@/components/TransactionDetail';

function App() {
  return (
    <Router>
      <Layout>
        <Routes>
          <Route path="/" element={<TransactionList />} />
          <Route path="/transaction/:id" element={<TransactionDetail />} />
        </Routes>
      </Layout>
    </Router>
  );
}

export default App;
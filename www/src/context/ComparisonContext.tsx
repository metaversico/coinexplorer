import React, { createContext, useContext, useState, ReactNode } from 'react';
import { Transaction } from '../types';

interface ComparisonContextType {
  selectedTransactions: Transaction[];
  isPaneOpen: boolean;
  addTransaction: (transaction: Transaction) => void;
  removeTransaction: (id: string) => void;
  clearSelection: () => void;
  togglePane: () => void;
  openPane: () => void;
  closePane: () => void;
  isSelected: (id: string) => boolean;
}

const ComparisonContext = createContext<ComparisonContextType | undefined>(undefined);

export const useComparison = () => {
  const context = useContext(ComparisonContext);
  if (!context) {
    throw new Error('useComparison must be used within a ComparisonProvider');
  }
  return context;
};

interface ComparisonProviderProps {
  children: ReactNode;
}

export const ComparisonProvider: React.FC<ComparisonProviderProps> = ({ children }) => {
  const [selectedTransactions, setSelectedTransactions] = useState<Transaction[]>([]);
  const [isPaneOpen, setIsPaneOpen] = useState(false);

  const addTransaction = (transaction: Transaction) => {
    setSelectedTransactions(prev => {
      if (prev.find(t => t.id === transaction.id)) {
        return prev;
      }
      return [...prev, transaction];
    });
    if (!isPaneOpen) {
      setIsPaneOpen(true);
    }
  };

  const removeTransaction = (id: string) => {
    setSelectedTransactions(prev => prev.filter(t => t.id !== id));
  };

  const clearSelection = () => {
    setSelectedTransactions([]);
  };

  const togglePane = () => {
    setIsPaneOpen(prev => !prev);
  };

  const openPane = () => {
    setIsPaneOpen(true);
  };

  const closePane = () => {
    setIsPaneOpen(false);
  };

  const isSelected = (id: string) => {
    return selectedTransactions.some(t => t.id === id);
  };

  const value: ComparisonContextType = {
    selectedTransactions,
    isPaneOpen,
    addTransaction,
    removeTransaction,
    clearSelection,
    togglePane,
    openPane,
    closePane,
    isSelected,
  };

  return (
    <ComparisonContext.Provider value={value}>
      {children}
    </ComparisonContext.Provider>
  );
};
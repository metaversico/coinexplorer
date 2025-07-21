import { createContext, useContext, useState, ReactNode } from 'react';
import { Transaction } from '../types';

export type SortOrder = 'latest' | 'earliest';

export interface LocalFilterState {
  methodFilter: string | null;
  sortOrder: SortOrder;
}

export interface LocalFilterContextType {
  filters: LocalFilterState;
  setMethodFilter: (method: string | null) => void;
  setSortOrder: (order: SortOrder) => void;
  resetFilters: () => void;
  filterTransactions: (transactions: Transaction[]) => Transaction[];
}

const LocalFilterContext = createContext<LocalFilterContextType | undefined>(undefined);

const defaultFilters: LocalFilterState = {
  methodFilter: null,
  sortOrder: 'latest',
};

export function LocalFilterProvider({ children }: { children: ReactNode }) {
  const [filters, setFilters] = useState<LocalFilterState>(defaultFilters);

  const setMethodFilter = (method: string | null) => {
    setFilters(prev => ({ ...prev, methodFilter: method }));
  };

  const setSortOrder = (order: SortOrder) => {
    setFilters(prev => ({ ...prev, sortOrder: order }));
  };

  const resetFilters = () => {
    setFilters(defaultFilters);
  };

  const filterTransactions = (transactions: Transaction[]): Transaction[] => {
    let filtered = [...transactions];

    // Apply method filter
    if (filters.methodFilter) {
      filtered = filtered.filter(tx => tx.method === filters.methodFilter);
    }

    // Apply sorting
    filtered.sort((a, b) => {
      const dateA = new Date(a.created_at).getTime();
      const dateB = new Date(b.created_at).getTime();
      
      return filters.sortOrder === 'latest' 
        ? dateB - dateA  // Latest first
        : dateA - dateB; // Earliest first
    });

    return filtered;
  };

  return (
    <LocalFilterContext.Provider value={{
      filters,
      setMethodFilter,
      setSortOrder,
      resetFilters,
      filterTransactions,
    }}>
      {children}
    </LocalFilterContext.Provider>
  );
}

export function useLocalFilter() {
  const context = useContext(LocalFilterContext);
  if (context === undefined) {
    throw new Error('useLocalFilter must be used within a LocalFilterProvider');
  }
  return context;
}
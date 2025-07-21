import React from 'react';
import { X, Minimize2 } from 'lucide-react';
import { useComparison } from '../context/ComparisonContext';
import { useLocalFilter, LocalFilterProvider } from '../context/LocalFilterContext';
import { Card, CardContent, CardHeader, CardTitle } from './ui/card';
import { Button } from './ui/button';
import { Transaction } from '../types';
import { ComparisonFilter } from './ComparisonFilter';

const TransactionCard: React.FC<{ transaction: Transaction; onRemove: () => void }> = ({ 
  transaction, 
  onRemove 
}) => {
  const formatMethodName = (method: string) => {
    return method.replace(/([A-Z])/g, ' $1').replace(/^./, str => str.toUpperCase());
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleString();
  };

  const isError = transaction.error !== null;

  return (
    <Card className="h-full flex flex-col">
      <CardHeader className="pb-2">
        <div className="flex justify-between items-start">
          <CardTitle className="text-sm font-medium">
            {formatMethodName(transaction.method)}
          </CardTitle>
          <Button
            variant="ghost"
            size="sm"
            onClick={onRemove}
            className="h-6 w-6 p-0 hover:bg-red-100"
          >
            <X className="h-3 w-3" />
          </Button>
        </div>
        <div className="text-xs text-gray-500">
          ID: {transaction.id.substring(0, 8)}...
        </div>
      </CardHeader>
      <CardContent className="flex-1 overflow-auto text-xs space-y-3">
        <div>
          <div className="font-medium text-gray-700 mb-1">Status</div>
          <div className={`inline-block px-2 py-1 rounded text-xs ${
            isError ? 'bg-red-100 text-red-800' : 'bg-green-100 text-green-800'
          }`}>
            {isError ? 'Error' : 'Success'}
          </div>
        </div>

        <div>
          <div className="font-medium text-gray-700 mb-1">Created</div>
          <div>{formatDate(transaction.created_at)}</div>
        </div>

        {transaction.completed_at && (
          <div>
            <div className="font-medium text-gray-700 mb-1">Completed</div>
            <div>{formatDate(transaction.completed_at)}</div>
          </div>
        )}

        {transaction.source_url && (
          <div>
            <div className="font-medium text-gray-700 mb-1">Source URL</div>
            <div className="break-all">{transaction.source_url}</div>
          </div>
        )}

        <div>
          <div className="font-medium text-gray-700 mb-1">Parameters</div>
          <pre className="bg-gray-50 p-2 rounded text-xs overflow-auto max-h-32">
            {JSON.stringify(transaction.params, null, 2)}
          </pre>
        </div>

        {transaction.result && (
          <div>
            <div className="font-medium text-gray-700 mb-1">Result</div>
            <pre className="bg-gray-50 p-2 rounded text-xs overflow-auto max-h-32">
              {JSON.stringify(transaction.result, null, 2)}
            </pre>
          </div>
        )}

        {transaction.error && (
          <div>
            <div className="font-medium text-gray-700 mb-1">Error</div>
            <div className="bg-red-50 border border-red-200 p-2 rounded text-red-800 text-xs">
              {transaction.error}
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
};

const ComparisonPaneContent: React.FC = () => {
  const { 
    selectedTransactions, 
    isPaneOpen, 
    removeTransaction, 
    clearSelection, 
    closePane 
  } = useComparison();
  const { filterTransactions } = useLocalFilter();

  if (!isPaneOpen) {
    return null;
  }

  const filteredSelectedTransactions = filterTransactions(selectedTransactions);

  return (
    <div className="fixed right-0 top-0 h-full w-1/2 bg-white border-l border-gray-200 shadow-lg z-50 flex flex-col">
      <div className="flex items-center justify-between p-4 border-b border-gray-200">
        <div>
          <h2 className="text-lg font-semibold">
            Transaction Comparison ({selectedTransactions.length})
          </h2>
          {selectedTransactions.length !== filteredSelectedTransactions.length && (
            <p className="text-xs text-gray-500 mt-1">
              {filteredSelectedTransactions.length} shown after filtering
            </p>
          )}
        </div>
        <div className="flex gap-2">
          <Button
            variant="ghost"
            size="sm"
            onClick={clearSelection}
            disabled={selectedTransactions.length === 0}
          >
            Clear All
          </Button>
          <Button
            variant="ghost"
            size="sm"
            onClick={closePane}
          >
            <Minimize2 className="h-4 w-4" />
          </Button>
        </div>
      </div>

      <ComparisonFilter />

      {selectedTransactions.length === 0 ? (
        <div className="flex-1 flex items-center justify-center text-gray-500">
          <div className="text-center">
            <div className="text-lg mb-2">No transactions selected</div>
            <div className="text-sm">Click on transactions in the list to compare them</div>
          </div>
        </div>
      ) : filteredSelectedTransactions.length === 0 ? (
        <div className="flex-1 flex items-center justify-center text-gray-500">
          <div className="text-center">
            <div className="text-lg mb-2">No transactions match filters</div>
            <div className="text-sm">Adjust your filters to see selected transactions</div>
          </div>
        </div>
      ) : (
        <div className="flex-1 overflow-auto p-4">
          <div className={`grid gap-4 h-full ${
            filteredSelectedTransactions.length === 1 
              ? 'grid-cols-1' 
              : filteredSelectedTransactions.length === 2 
                ? 'grid-cols-1 xl:grid-cols-2' 
                : 'grid-cols-1 xl:grid-cols-2 2xl:grid-cols-3'
          }`}>
            {filteredSelectedTransactions.map((transaction) => (
              <TransactionCard
                key={transaction.id}
                transaction={transaction}
                onRemove={() => removeTransaction(transaction.id)}
              />
            ))}
          </div>
        </div>
      )}
    </div>
  );
};

export const ComparisonPane: React.FC = () => {
  return (
    <LocalFilterProvider>
      <ComparisonPaneContent />
    </LocalFilterProvider>
  );
};
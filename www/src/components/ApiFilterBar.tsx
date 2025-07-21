import { Filter, X, ArrowUp, ArrowDown } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { SortOrder, TransactionFilters } from '../lib/api';

const RPC_METHODS = [
  'getSignaturesForAddress',
  'getTransaction',
];

interface ApiFilterBarProps {
  filters: TransactionFilters;
  onFiltersChange: (filters: TransactionFilters) => void;
}

export function ApiFilterBar({ filters, onFiltersChange }: ApiFilterBarProps) {
  const handleMethodFilter = (method: string) => {
    const newMethod = filters.method === method ? null : method;
    onFiltersChange({ ...filters, method: newMethod });
  };

  const handleSortOrder = (sortOrder: SortOrder) => {
    onFiltersChange({ ...filters, sortOrder });
  };

  const resetFilters = () => {
    onFiltersChange({ method: null, sortOrder: 'latest' });
  };

  const hasActiveFilters = filters.method !== null;

  return (
    <Card className="mb-6">
      <CardContent className="p-4">
        <div className="flex flex-wrap items-center gap-4">
          <div className="flex items-center gap-2">
            <Filter className="h-4 w-4 text-gray-500" />
            <span className="text-sm font-medium text-gray-700">Filters:</span>
          </div>

          {/* Method Filter */}
          <div className="flex items-center gap-2">
            <span className="text-sm text-gray-600">Method:</span>
            <div className="flex gap-1">
              {RPC_METHODS.map((method) => (
                <Button
                  key={method}
                  variant={filters.method === method ? "default" : "outline"}
                  size="sm"
                  onClick={() => handleMethodFilter(method)}
                  className="text-xs"
                >
                  {method}
                </Button>
              ))}
            </div>
          </div>

          {/* Sort Order */}
          <div className="flex items-center gap-2">
            <span className="text-sm text-gray-600">Sort:</span>
            <Button
              variant={filters.sortOrder === 'latest' ? "default" : "outline"}
              size="sm"
              onClick={() => handleSortOrder('latest')}
              className="text-xs flex items-center gap-1"
            >
              <ArrowDown className="h-3 w-3" />
              Latest First
            </Button>
            <Button
              variant={filters.sortOrder === 'earliest' ? "default" : "outline"}
              size="sm"
              onClick={() => handleSortOrder('earliest')}
              className="text-xs flex items-center gap-1"
            >
              <ArrowUp className="h-3 w-3" />
              Earliest First
            </Button>
          </div>

          {/* Reset Filters */}
          {hasActiveFilters && (
            <Button
              variant="ghost"
              size="sm"
              onClick={resetFilters}
              className="text-xs flex items-center gap-1 text-gray-500 hover:text-gray-700"
            >
              <X className="h-3 w-3" />
              Clear Filters
            </Button>
          )}
        </div>

        {/* Active Filter Display */}
        {hasActiveFilters && (
          <div className="mt-3 pt-3 border-t border-gray-200">
            <div className="flex flex-wrap items-center gap-2">
              <span className="text-xs text-gray-500">Active filters:</span>
              {filters.method && (
                <div className="inline-flex items-center gap-1 bg-blue-100 text-blue-800 px-2 py-1 rounded-full text-xs">
                  Method: {filters.method}
                  <button
                    onClick={() => handleMethodFilter(filters.method!)}
                    className="ml-1 hover:bg-blue-200 rounded-full p-0.5"
                  >
                    <X className="h-2.5 w-2.5" />
                  </button>
                </div>
              )}
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
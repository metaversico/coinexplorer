import { useState } from 'react';
import { Filter, ChevronDown, X, ArrowUp, ArrowDown } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useLocalFilter, SortOrder } from '../context/LocalFilterContext';

const RPC_METHODS = [
  'getSignaturesForAddress',
  'getTransaction',
];

export function ComparisonFilter() {
  const [isExpanded, setIsExpanded] = useState(false);
  const { filters, setMethodFilter, setSortOrder } = useLocalFilter();

  return (
    <div className="border-b border-gray-200 bg-gray-50">
      <div className="p-3">
        <Button
          variant="ghost"
          size="sm"
          onClick={() => setIsExpanded(!isExpanded)}
          className="w-full justify-between text-xs"
        >
          <div className="flex items-center gap-1">
            <Filter className="h-3 w-3" />
            Filter & Sort
          </div>
          <ChevronDown className={`h-3 w-3 transition-transform ${isExpanded ? 'rotate-180' : ''}`} />
        </Button>

        {isExpanded && (
          <div className="mt-3 space-y-3">
            {/* Method Filter */}
            <div>
              <div className="text-xs text-gray-600 mb-2">Method:</div>
              <div className="grid grid-cols-1 gap-1">
                {RPC_METHODS.map((method) => (
                  <Button
                    key={method}
                    variant={filters.methodFilter === method ? "default" : "outline"}
                    size="sm"
                    onClick={() => setMethodFilter(filters.methodFilter === method ? null : method)}
                    className="text-xs h-7 justify-start"
                  >
                    {method}
                  </Button>
                ))}
              </div>
            </div>

            {/* Sort Order */}
            <div>
              <div className="text-xs text-gray-600 mb-2">Sort:</div>
              <div className="space-y-1">
                <Button
                  variant={filters.sortOrder === 'latest' ? "default" : "outline"}
                  size="sm"
                  onClick={() => setSortOrder('latest' as SortOrder)}
                  className="text-xs h-7 w-full justify-start"
                >
                  <ArrowDown className="h-3 w-3 mr-1" />
                  Latest First
                </Button>
                <Button
                  variant={filters.sortOrder === 'earliest' ? "default" : "outline"}
                  size="sm"
                  onClick={() => setSortOrder('earliest' as SortOrder)}
                  className="text-xs h-7 w-full justify-start"
                >
                  <ArrowUp className="h-3 w-3 mr-1" />
                  Earliest First
                </Button>
              </div>
            </div>

            {/* Active filters */}
            {filters.methodFilter && (
              <div className="pt-2 border-t border-gray-200">
                <div className="text-xs text-gray-600 mb-1">Active:</div>
                <div className="inline-flex items-center gap-1 bg-blue-100 text-blue-800 px-2 py-1 rounded text-xs">
                  {filters.methodFilter}
                  <button
                    onClick={() => setMethodFilter(null)}
                    className="ml-1 hover:bg-blue-200 rounded p-0.5"
                  >
                    <X className="h-2 w-2" />
                  </button>
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
import React, { useState } from 'react';
import { Menu, ChevronLeft, ChevronRight, BarChart3, Search, Home } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useComparison } from '../context/ComparisonContext';
import { ComparisonPane } from './ComparisonPane';

interface LayoutProps {
  children: React.ReactNode;
}

export function Layout({ children }: LayoutProps) {
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const { selectedTransactions, isPaneOpen, togglePane } = useComparison();

  return (
    <div className="min-h-screen bg-background">
      {/* Top Navigation */}
      <header className="border-b bg-white shadow-sm">
        <div className="flex h-14 items-center px-4">
          <Button
            variant="ghost"
            size="icon"
            onClick={() => setSidebarOpen(!sidebarOpen)}
            className="mr-4"
          >
            <Menu className="h-4 w-4" />
          </Button>
          <div className="flex items-center justify-between w-full">
            <nav className="flex items-center space-x-6">
              <span className="text-sm font-medium text-muted-foreground">Coinexplorer</span>
              <span className="text-sm text-muted-foreground">|</span>
              <span className="text-sm text-muted-foreground">Explorer</span>
            </nav>
            <Button
              variant="ghost"
              size="sm"
              onClick={togglePane}
              className={`flex items-center gap-2 ${isPaneOpen ? 'bg-blue-100 text-blue-700' : ''}`}
            >
              <BarChart3 className="h-4 w-4" />
              Compare ({selectedTransactions.length})
            </Button>
          </div>
        </div>
      </header>

      <div className="flex">
        {/* Sidebar */}
        <aside
          className={`border-r bg-white transition-all duration-300 ${
            sidebarOpen ? 'w-64' : 'w-16'
          }`}
        >
          <div className="flex h-full flex-col">
            <div className="flex items-center justify-between p-4">
              {sidebarOpen && (
                <h2 className="text-lg font-semibold">Navigation</h2>
              )}
              <Button
                variant="ghost"
                size="icon"
                onClick={() => setSidebarOpen(!sidebarOpen)}
              >
                {sidebarOpen ? (
                  <ChevronLeft className="h-4 w-4" />
                ) : (
                  <ChevronRight className="h-4 w-4" />
                )}
              </Button>
            </div>
            <nav className="flex-1 space-y-2 p-4">
              <a
                href="/"
                className="flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium text-gray-900 hover:bg-gray-100"
              >
                <Home className="h-4 w-4" />
                {sidebarOpen && 'Transactions'}
              </a>
              <a
                href="/seek"
                className="flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium text-gray-900 hover:bg-gray-100"
              >
                <Search className="h-4 w-4" />
                {sidebarOpen && 'Seek Transaction'}
              </a>
            </nav>
          </div>
        </aside>

        {/* Main Content */}
        <main className={`flex-1 transition-all duration-300 ${isPaneOpen ? 'mr-[50%]' : ''}`}>
          {/* Masthead */}
          <div className="border-b bg-white px-6 py-4">
            <h1 className="text-2xl font-bold">Transaction Explorer</h1>
            <p className="text-muted-foreground">
              Browse RPC call results and transaction data
            </p>
          </div>

          {/* Content */}
          <div className="p-6">{children}</div>
        </main>

        {/* Comparison Pane */}
        <ComparisonPane />
      </div>
    </div>
  );
}
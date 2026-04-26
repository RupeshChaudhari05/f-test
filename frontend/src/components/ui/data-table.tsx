'use client';

import { useState, useMemo } from 'react';
import { ChevronUp, ChevronDown, ChevronsUpDown, Search, X } from 'lucide-react';
import { Input } from './input';
import { cn } from '@/lib/utils';

export interface ColumnDef<T> {
  key: keyof T | string;
  header: string;
  sortable?: boolean;
  searchable?: boolean;          // included in global search
  className?: string;            // th/td className
  render?: (row: T) => React.ReactNode;
  accessorFn?: (row: T) => string | number | null | undefined;  // for sorting/searching computed values
}

interface DataTableProps<T> {
  columns: ColumnDef<T>[];
  data: T[];
  /** Show built-in search bar */
  searchable?: boolean;
  searchPlaceholder?: string;
  emptyMessage?: string;
  /** Extra className on the wrapper div */
  className?: string;
  rowKey: (row: T) => string;
  /** Optionally render a footer row */
  footer?: React.ReactNode;
}

type SortDir = 'asc' | 'desc' | null;

function getCellValue<T>(row: T, col: ColumnDef<T>): string {
  if (col.accessorFn) return String(col.accessorFn(row) ?? '');
  const val = (row as any)[col.key as string];
  if (val === null || val === undefined) return '';
  return String(val);
}

export function DataTable<T>({
  columns,
  data,
  searchable = false,
  searchPlaceholder = 'Search…',
  emptyMessage = 'No data found',
  className,
  rowKey,
  footer,
}: DataTableProps<T>) {
  const [query, setQuery] = useState('');
  const [sortKey, setSortKey] = useState<string | null>(null);
  const [sortDir, setSortDir] = useState<SortDir>(null);

  const searchCols = useMemo(
    () => columns.filter((c) => c.searchable !== false),
    [columns],
  );

  const processed = useMemo(() => {
    let rows = [...data];

    // Filter
    if (query.trim()) {
      const q = query.toLowerCase();
      rows = rows.filter((row) =>
        searchCols.some((col) => getCellValue(row, col).toLowerCase().includes(q)),
      );
    }

    // Sort
    if (sortKey && sortDir) {
      const col = columns.find((c) => c.key === sortKey);
      rows.sort((a, b) => {
        const av = col ? getCellValue(a, col) : '';
        const bv = col ? getCellValue(b, col) : '';
        // numeric-aware comparison
        const an = parseFloat(av);
        const bn = parseFloat(bv);
        const isNum = !isNaN(an) && !isNaN(bn);
        const cmp = isNum ? an - bn : av.localeCompare(bv);
        return sortDir === 'asc' ? cmp : -cmp;
      });
    }

    return rows;
  }, [data, query, sortKey, sortDir, columns, searchCols]);

  const handleSort = (key: string) => {
    if (sortKey !== key) { setSortKey(key); setSortDir('asc'); return; }
    if (sortDir === 'asc') { setSortDir('desc'); return; }
    setSortKey(null); setSortDir(null);
  };

  const SortIcon = ({ colKey }: { colKey: string }) => {
    if (sortKey !== colKey) return <ChevronsUpDown className="h-3.5 w-3.5 text-muted-foreground/50" />;
    if (sortDir === 'asc') return <ChevronUp className="h-3.5 w-3.5 text-primary" />;
    return <ChevronDown className="h-3.5 w-3.5 text-primary" />;
  };

  return (
    <div className={cn('space-y-3', className)}>
      {searchable && (
        <div className="relative max-w-xs">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder={searchPlaceholder}
            className="pl-9 pr-8 h-9 text-sm"
          />
          {query && (
            <button
              onClick={() => setQuery('')}
              className="absolute right-2.5 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
            >
              <X className="h-3.5 w-3.5" />
            </button>
          )}
        </div>
      )}

      <div className="overflow-x-auto rounded-lg border bg-card">
        <table className="w-full text-sm">
          <thead className="bg-muted/40 border-b">
            <tr>
              {columns.map((col) => (
                <th
                  key={String(col.key)}
                  className={cn(
                    'px-4 py-3 text-left font-medium text-muted-foreground text-xs whitespace-nowrap select-none',
                    col.sortable !== false && 'cursor-pointer hover:text-foreground',
                    col.className,
                  )}
                  onClick={() => col.sortable !== false && handleSort(String(col.key))}
                >
                  <div className="flex items-center gap-1.5">
                    {col.header}
                    {col.sortable !== false && <SortIcon colKey={String(col.key)} />}
                  </div>
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {processed.length === 0 ? (
              <tr>
                <td
                  colSpan={columns.length}
                  className="px-4 py-10 text-center text-muted-foreground text-sm"
                >
                  {query ? `No results for "${query}"` : emptyMessage}
                </td>
              </tr>
            ) : (
              processed.map((row) => (
                <tr key={rowKey(row)} className="border-b last:border-0 hover:bg-muted/20 transition-colors">
                  {columns.map((col) => (
                    <td key={String(col.key)} className={cn('px-4 py-3 align-middle', col.className)}>
                      {col.render ? col.render(row) : getCellValue(row, col)}
                    </td>
                  ))}
                </tr>
              ))
            )}
          </tbody>
          {footer && (
            <tfoot className="border-t bg-muted/20">
              {footer}
            </tfoot>
          )}
        </table>
      </div>

      {processed.length > 0 && query && (
        <p className="text-xs text-muted-foreground">
          Showing {processed.length} of {data.length} rows
        </p>
      )}
    </div>
  );
}

import { useState, useMemo } from 'react';

import { Field, formattedValueToString } from '@grafana/data';

import { FilterType, TableRow } from './types';
import { getDisplayName, getIsNestedTable, processNestedTableRows } from './utils';

interface TableFiltersAndSortContextIFace {
  filter: FilterType;
  setFilter: React.Dispatch<React.SetStateAction<FilterType>>;
}

interface TableFiltersAndSort extends TableFiltersAndSortContextIFace {
  renderedRows: TableRow[];
  crossFilterOrder: string[];
  crossFilterRows: { [key: string]: TableRow[] };
}

// Helper function to get displayed value
const getDisplayedValue = (row: TableRow, key: string, fields: Field[]) => {
  const field = fields.find((field) => getDisplayName(field) === key);
  if (!field || !field.display) {
    return '';
  }
  const displayedValue = formattedValueToString(field.display(row[key]));
  return displayedValue;
};

export function useTableFiltersAndSorts(rows: TableRow[], fields: Field[]): TableFiltersAndSort {
  const [filter, setFilter] = useState<FilterType>({});

  const filterValues = useMemo(() => Object.entries(filter), [filter]);

  const crossFilterOrder: TableFiltersAndSort['crossFilterOrder'] = useMemo(() => {
    if (filterValues.length === 0) {
      return [];
    }

    // Update crossFilterOrder
    const filterKeys = new Set(filterValues.map(([key]) => key));
    return Array.from(filterKeys).reduce((accum: string[], key) => {
      if (!accum.includes(key)) {
        // Each time a filter is added or removed, it is always a single filter.
        // When adding a new filter, it is always appended to the end, maintaining the order.
        accum.push(key);
      }
      return accum;
    }, []);
  }, [filterValues]);

  const hasNestedFrames = useMemo(() => getIsNestedTable(fields), [fields]);

  const [filteredRows, crossFilterRows] = useMemo(() => {
    const crossFilterRows: TableFiltersAndSort['crossFilterRows'] = {};
    const filterFn = (row: TableRow): boolean => {
      for (const [key, value] of filterValues) {
        const displayedValue = getDisplayedValue(row, key, fields);
        if (!value.filteredSet.has(displayedValue)) {
          return false;
        }
        // collect rows for crossFilter
        crossFilterRows[key] = crossFilterRows[key] ?? [];
        crossFilterRows[key].push(row);
      }
      return true;
    };
    const filteredRows = hasNestedFrames
      ? processNestedTableRows(rows, (parents) => parents.filter(filterFn))
      : rows.filter(filterFn);
    return [filteredRows, crossFilterRows];
  }, [filterValues, rows, fields, hasNestedFrames]);

  // TODO add sorting in here.

  return {
    filter,
    setFilter,
    renderedRows: filteredRows,
    crossFilterOrder,
    crossFilterRows,
  };
}

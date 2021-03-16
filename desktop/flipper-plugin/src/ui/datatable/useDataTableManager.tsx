/**
 * Copyright (c) Facebook, Inc. and its affiliates.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 *
 * @format
 */

import {DataTableColumn} from 'flipper-plugin/src/ui/datatable/DataTable';
import {Percentage} from '../utils/widthUtils';
import produce from 'immer';
import {useCallback, useEffect, useMemo, useState} from 'react';
import {DataSource} from '../../state/datasource/DataSource';

export type OnColumnResize = (id: string, size: number | Percentage) => void;
export type Sorting = {
  key: string;
  direction: 'up' | 'down';
};

export type TableManager = ReturnType<typeof useDataTableManager>;

/**
 * A hook that coordinates filtering, sorting etc for a DataSource
 */
export function useDataTableManager<T extends object>(
  dataSource: DataSource<T>,
  defaultColumns: DataTableColumn<T>[],
  onSelect?: (item: T | undefined, index: number) => void,
) {
  const [columns, setEffectiveColumns] = useState(
    computeInitialColumns(defaultColumns),
  );
  // TODO: move selection with shifts with index < selection?
  // TODO: clear selection if out of range
  const [selection, setSelection] = useState(-1);
  const [sorting, setSorting] = useState<Sorting | undefined>(undefined);
  const [searchValue, setSearchValue] = useState('');
  const visibleColumns = useMemo(
    () => columns.filter((column) => column.visible),
    [columns],
  );

  // filter is computed by useMemo to support adding column filters etc here in the future
  const currentFilter = useMemo(
    function computeFilter() {
      if (searchValue === '') {
        // unset
        return undefined;
      }

      const searchString = searchValue.toLowerCase();
      return function dataTableFilter(item: object) {
        return Object.values(item).some((v) =>
          String(v).toLowerCase().includes(searchString),
        );
      };
    },
    [searchValue],
  );

  const reset = useCallback(() => {
    setEffectiveColumns(computeInitialColumns(defaultColumns));
    setSorting(undefined);
    dataSource.reset();
    // TODO: local storage
  }, [dataSource, defaultColumns]);

  const resizeColumn = useCallback((id: string, width: number | Percentage) => {
    setEffectiveColumns(
      // TODO: fix typing of produce
      produce((columns: DataTableColumn<any>[]) => {
        const col = columns.find((c) => c.key === id)!;
        col.width = width;
      }),
    );
  }, []);

  const sortColumn = useCallback(
    (key: string) => {
      if (sorting?.key === key) {
        if (sorting.direction === 'down') {
          setSorting({key, direction: 'up'});
          dataSource.setReversed(true);
        } else {
          setSorting(undefined);
          dataSource.setSortBy(undefined);
          dataSource.setReversed(false);
        }
      } else {
        setSorting({
          key,
          direction: 'down',
        });
        dataSource.setSortBy(key as any);
        dataSource.setReversed(false);
      }
    },
    [dataSource, sorting],
  );

  const toggleColumnVisibility = useCallback((id: string) => {
    setEffectiveColumns(
      // TODO: fix typing of produce
      produce((columns: DataTableColumn<any>[]) => {
        const col = columns.find((c) => c.key === id)!;
        col.visible = !col.visible;
      }),
    );
  }, []);

  const selectItem = useCallback(
    (updater: (currentIndex: number) => number) => {
      setSelection((currentIndex) => {
        const newIndex = updater(currentIndex);
        const item =
          newIndex >= 0 && newIndex < dataSource.output.length
            ? dataSource.getItem(newIndex)
            : undefined;
        onSelect?.(item, newIndex);
        return newIndex;
      });
    },
    [setSelection, onSelect, dataSource],
  );

  useEffect(
    function applyFilter() {
      dataSource.setFilter(currentFilter);
    },
    [currentFilter, dataSource],
  );

  return {
    /** The default columns, but normalized */
    columns,
    /** The effective columns to be rendererd */
    visibleColumns,
    /** The currently applicable sorting, if any */
    sorting,
    /** Reset the current table preferences, including column widths an visibility, back to the default */
    reset,
    /** Resizes the column with the given key to the given width */
    resizeColumn,
    /** Sort by the given column. This toggles statefully between ascending, descending, none (insertion order of the data source) */
    sortColumn,
    /** Show / hide the given column */
    toggleColumnVisibility,
    /** Active search value */
    setSearchValue,
    /** current selection, describes the index index in the datasources's current output (not window) */
    selection,
    selectItem,
  };
}

function computeInitialColumns(
  columns: DataTableColumn<any>[],
): DataTableColumn<any>[] {
  return columns.map((c) => ({
    ...c,
    visible: c.visible !== false,
  }));
}

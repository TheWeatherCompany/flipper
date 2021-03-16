/**
 * Copyright (c) Facebook, Inc. and its affiliates.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 *
 * @format
 */

import React, {
  useCallback,
  useLayoutEffect,
  useMemo,
  useRef,
  RefObject,
  MutableRefObject,
} from 'react';
import {TableRow, DEFAULT_ROW_HEIGHT} from './TableRow';
import {DataSource} from '../../state/datasource/DataSource';
import {Layout} from '../Layout';
import {TableHead} from './TableHead';
import {Percentage} from '../utils/widthUtils';
import {DataSourceRenderer, DataSourceVirtualizer} from './DataSourceRenderer';
import {useDataTableManager, TableManager} from './useDataTableManager';
import {TableSearch} from './TableSearch';

interface DataTableProps<T = any> {
  columns: DataTableColumn<T>[];
  dataSource: DataSource<T, any, any>;
  autoScroll?: boolean;
  extraActions?: React.ReactElement;
  // custom onSearch(text, row) option?
  /**
   * onSelect event
   * @param item currently selected item
   * @param index index of the selected item in the datasources' output.
   * Note that the index could potentially refer to a different item if rendering is 'behind' and items have shifted
   */
  onSelect?(item: T | undefined, index: number): void;
  // multiselect?: true
  // onMultiSelect
  tableManagerRef?: RefObject<TableManager>;
  _testHeight?: number; // exposed for unit testing only
}

export type DataTableColumn<T = any> = {
  key: keyof T & string;
  // possible future extension: getValue(row) (and free-form key) to support computed columns
  onRender?: (row: T) => React.ReactNode;
  title?: string;
  width?: number | Percentage | undefined; // undefined: use all remaining width
  wrap?: boolean;
  align?: 'left' | 'right' | 'center';
  visible?: boolean;
};

export interface RenderContext<T = any> {
  columns: DataTableColumn<T>[];
  onClick(item: T, itemId: number): void;
}

export function DataTable<T extends object>(props: DataTableProps<T>) {
  const {dataSource} = props;
  const virtualizerRef = useRef<DataSourceVirtualizer | undefined>();
  const tableManager = useDataTableManager<T>(
    dataSource,
    props.columns,
    props.onSelect,
  );
  if (props.tableManagerRef) {
    (props.tableManagerRef as MutableRefObject<TableManager>).current = tableManager;
  }
  const {visibleColumns, selectItem, selection} = tableManager;

  const renderingConfig = useMemo<RenderContext<T>>(() => {
    return {
      columns: visibleColumns,
      onClick(_, itemIdx) {
        selectItem(() => itemIdx);
      },
    };
  }, [visibleColumns, selectItem]);

  const usesWrapping = useMemo(
    () => tableManager.columns.some((col) => col.wrap),
    [tableManager.columns],
  );

  const itemRenderer = useCallback(
    function itemRenderer(
      item: any,
      index: number,
      renderContext: RenderContext<T>,
    ) {
      return (
        <TableRow
          key={index}
          config={renderContext}
          value={item}
          itemIndex={index}
          highlighted={index === tableManager.selection}
        />
      );
    },
    [tableManager.selection],
  );

  /**
   * Keyboard / selection handling
   */
  const onKeyDown = useCallback(
    (e: React.KeyboardEvent<any>) => {
      let handled = true;
      switch (e.key) {
        case 'ArrowUp':
          selectItem((idx) => (idx > 0 ? idx - 1 : 0));
          break;
        case 'ArrowDown':
          selectItem((idx) =>
            idx < dataSource.output.length - 1 ? idx + 1 : idx,
          );
          break;
        case 'Home':
          selectItem(() => 0);
          break;
        case 'End':
          selectItem(() => dataSource.output.length - 1);
          break;
        case 'PageDown':
          selectItem((idx) =>
            Math.min(
              dataSource.output.length - 1,
              idx + virtualizerRef.current!.virtualItems.length - 1,
            ),
          );
          break;
        case 'PageUp':
          selectItem((idx) =>
            Math.max(0, idx - virtualizerRef.current!.virtualItems.length - 1),
          );
          break;
        default:
          handled = false;
      }
      if (handled) {
        e.stopPropagation();
        e.preventDefault();
      }
    },
    [selectItem, dataSource],
  );

  useLayoutEffect(
    function scrollSelectionIntoView() {
      if (selection >= 0) {
        virtualizerRef.current?.scrollToIndex(selection, {
          align: 'auto',
        });
      }
    },
    [selection],
  );

  return (
    <Layout.Top>
      <Layout.Container>
        <TableSearch
          onSearch={tableManager.setSearchValue}
          extraActions={props.extraActions}
        />
        <TableHead
          columns={tableManager.columns}
          visibleColumns={tableManager.visibleColumns}
          onColumnResize={tableManager.resizeColumn}
          onReset={tableManager.reset}
          onColumnToggleVisibility={tableManager.toggleColumnVisibility}
          sorting={tableManager.sorting}
          onColumnSort={tableManager.sortColumn}
        />
      </Layout.Container>
      <DataSourceRenderer<T, RenderContext<T>>
        dataSource={dataSource}
        autoScroll={props.autoScroll}
        useFixedRowHeight={!usesWrapping}
        defaultRowHeight={DEFAULT_ROW_HEIGHT}
        context={renderingConfig}
        itemRenderer={itemRenderer}
        onKeyDown={onKeyDown}
        virtualizerRef={virtualizerRef}
        _testHeight={props._testHeight}
      />
    </Layout.Top>
  );
}

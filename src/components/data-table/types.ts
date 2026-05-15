export interface ColumnDef {
  /** Unique key. Must not start with `__` (reserved for built-in columns). */
  key: string;
  /** Header label. Empty string suppresses the column from the visibility menu. */
  label: string;
  /** If set, the header is sortable and emits this value via `update:sortBy`. */
  sortBy?: string;
  /** Default rendered width in px. Defaults to 160. */
  defaultWidth?: number;
  /** Minimum width when the user drags the resize handle. Defaults to 80. */
  minWidth?: number;
  /** Whether this column is visible on first mount. Defaults to true. */
  defaultVisible?: boolean;
  /** When true, the column cannot be hidden via the columns menu. */
  alwaysVisible?: boolean;
  /** When true, a "Freeze column" item appears in the header menu. */
  freezable?: boolean;
  /** When true (and `freezable`), the column starts pinned to the left. */
  defaultFrozen?: boolean;
  /** Cell text-align. Headers always show label-left, menu-right. */
  align?: "left" | "center" | "right";
  /** Prevent text wrapping inside the cell. */
  whitespaceNowrap?: boolean;
  /** Extra classes applied to the `<td>`. Use `!`-prefixed Tailwind utilities
   *  (e.g. `"!p-0"`) when you need to override the default cell padding. */
  cellClass?: string;
}

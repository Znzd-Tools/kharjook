'use client';

import { useMemo, useState } from 'react';
import { SearchField } from '@/design-system';
import { ChevronDown, ChevronLeft, LayoutGrid as Folder, X as Ban } from '@/design-system/icons';
import { BottomSheet } from '@/shared/components/BottomSheet';
import { haptic } from '@/shared/utils/haptics';
import type { Category, CategoryKind } from '@/shared/types/domain';

export interface CategorySheetPickerProps {
  open: boolean;
  onClose: () => void;
  title: string;
  kind: CategoryKind;
  categories: Category[];
  value: string | null;
  onSelect: (id: string | null) => void;
  /** When true, shows a row that selects `null` (e.g. "no category"). */
  allowNone?: boolean;
  /** Label for the "none" row. Defaults to "— بدون انتخاب —". */
  noneLabel?: string;
  /**
   * Category ids that must not appear. Their entire subtree is also hidden
   * (used by the parent picker to prevent cycles when re-parenting).
   */
  excludeIds?: ReadonlySet<string>;
}

interface FlatItem {
  id: string;
  name: string;
  color: string;
  depth: number;
}

interface TreeMaps {
  byParent: Map<string | null, Category[]>;
  byId: Map<string, Category>;
}

function buildTreeMaps(scoped: Category[], excludeIds: ReadonlySet<string>): TreeMaps {
  const byParent = new Map<string | null, Category[]>();
  const byId = new Map(scoped.map((c) => [c.id, c]));

  const excluded = new Set<string>();
  const markExcludedSubtree = (id: string) => {
    if (excluded.has(id)) return;
    excluded.add(id);
    for (const c of scoped) {
      if (c.parent_id === id) markExcludedSubtree(c.id);
    }
  };
  excludeIds.forEach((id) => markExcludedSubtree(id));

  for (const c of scoped) {
    if (excluded.has(c.id)) continue;
    const key = c.parent_id ?? null;
    const arr = byParent.get(key) ?? [];
    arr.push(c);
    byParent.set(key, arr);
  }

  // Orphans should still be selectable as root-level rows.
  const visibleIds = new Set<string>();
  byParent.forEach((arr) => arr.forEach((c) => visibleIds.add(c.id)));
  for (const c of scoped) {
    if (!visibleIds.has(c.id)) continue;
    const parentExists = c.parent_id ? visibleIds.has(c.parent_id) : false;
    if (c.parent_id && !parentExists) {
      const arr = byParent.get(null) ?? [];
      if (!arr.some((x) => x.id === c.id)) {
        arr.push(c);
        byParent.set(null, arr);
      }
    }
  }

  return { byParent, byId };
}

function flattenForest(
  scoped: Category[],
  query: string,
  excludeIds: ReadonlySet<string>
): FlatItem[] {
  const byParent = new Map<string | null, Category[]>();
  for (const c of scoped) {
    const key = c.parent_id ?? null;
    const arr = byParent.get(key) ?? [];
    arr.push(c);
    byParent.set(key, arr);
  }

  const q = query.trim().toLowerCase();
  const out: FlatItem[] = [];

  const visit = (parentId: string | null, depth: number) => {
    const nodes = byParent.get(parentId) ?? [];
    for (const n of nodes) {
      // Excluding a node also excludes its subtree. This is intentional:
      // the only caller that exclude-lists nodes is the cycle-prevention
      // parent picker, which needs the entire descendant set gone.
      if (excludeIds.has(n.id)) continue;
      out.push({ id: n.id, name: n.name, color: n.color, depth });
      visit(n.id, depth + 1);
    }
  };
  visit(null, 0);

  // Orphans: parent points outside `scoped` (different kind, or missing).
  // Surface them at root so they're never silently lost.
  const scopedIds = new Set(scoped.map((c) => c.id));
  for (const c of scoped) {
    if (excludeIds.has(c.id)) continue;
    if (!c.parent_id || scopedIds.has(c.parent_id)) continue;
    if (out.some((o) => o.id === c.id)) continue;
    out.push({ id: c.id, name: c.name, color: c.color, depth: 0 });
  }

  if (!q) return out;
  return out.filter((it) => it.name.toLowerCase().includes(q));
}

export function CategorySheetPicker({
  open,
  onClose,
  title,
  kind,
  categories,
  value,
  onSelect,
  allowNone = false,
  noneLabel = '— بدون انتخاب —',
  excludeIds,
}: CategorySheetPickerProps) {
  const [query, setQuery] = useState('');
  const [expandedIds, setExpandedIds] = useState<Set<string>>(new Set());

  const scoped = useMemo(
    () => categories.filter((c) => c.kind === kind),
    [categories, kind]
  );

  const exclude = excludeIds ?? EMPTY_SET;
  const maps = useMemo(() => buildTreeMaps(scoped, exclude), [scoped, exclude]);
  const items = useMemo(
    () => flattenForest(scoped, query, exclude),
    [scoped, query, exclude]
  );
  const isSearching = query.trim().length > 0;

  const pathExpandedIds = useMemo(() => {
    if (!value || isSearching) return null;
    const next = new Set<string>();
    let cursor = maps.byId.get(value) ?? null;
    while (cursor?.parent_id) {
      next.add(cursor.parent_id);
      cursor = maps.byId.get(cursor.parent_id) ?? null;
    }
    return next.size > 0 ? next : null;
  }, [value, maps, isSearching]);

  const visibleExpandedIds = useMemo(() => {
    if (expandedIds.size > 0) return expandedIds;
    return pathExpandedIds ?? expandedIds;
  }, [expandedIds, pathExpandedIds]);

  const commit = (id: string | null) => {
    haptic('selection');
    onSelect(id);
    onClose();
    setQuery('');
  };

  const toggleExpanded = (id: string) => {
    setExpandedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  return (
    <BottomSheet
      open={open}
      onClose={() => {
        onClose();
        setQuery('');
        setExpandedIds(new Set());
      }}
      title={title}
      header={<SearchField value={query} onValueChange={setQuery} placeholder="جستجو..." aria-label="جستجو" autoFocus />}
    >
      <div className="space-y-1.5">
        {allowNone && (
          <button
            type="button"
            onClick={() => commit(null)}
            className={`ds-focus w-full flex items-center gap-3 rounded-control p-3 text-start transition-colors ${
              value === null
                ? 'bg-accent-soft'
                : 'bg-panel hover:bg-hover'
            }`}
          >
            <Ban
              size={14}
              className={value === null ? 'text-accent-ink' : 'text-fg-subtle'}
            />
            <span
              className={`flex-1 min-w-0 text-callout truncate ${
                value === null ? 'text-fg font-semibold' : 'text-fg'
              }`}
            >
              {noneLabel}
            </span>
          </button>
        )}

        {isSearching && items.length === 0 ? (
          !allowNone && (
            <p className="text-caption text-fg-subtle py-8 text-center">
              دسته‌ای یافت نشد.
            </p>
          )
        ) : (
          <>
            {isSearching ? (
              items.map((it) => {
                const selected = value === it.id;
                return (
                  <button
                    key={it.id}
                    type="button"
                    onClick={() => commit(it.id)}
                    className={`ds-focus w-full flex items-center gap-3 rounded-control p-3 text-start transition-colors ${
                      selected
                        ? 'bg-accent-soft'
                        : 'bg-panel hover:bg-hover'
                    }`}
                    style={{ paddingInlineStart: `${12 + it.depth * 18}px` }}
                  >
                    <span
                      className="size-2.5 rounded-full shrink-0"
                      style={{ backgroundColor: it.color }}
                    />
                    <Folder
                      size={14}
                      className={selected ? 'text-accent-ink' : 'text-fg-subtle'}
                    />
                    <span
                      className={`flex-1 min-w-0 text-callout truncate ${
                        selected ? 'text-fg font-semibold' : 'text-fg'
                      }`}
                    >
                      {it.name}
                    </span>
                  </button>
                );
              })
            ) : (
              <CategoryTree
                parentId={null}
                depth={0}
                maps={maps}
                expandedIds={visibleExpandedIds}
                onToggleExpanded={toggleExpanded}
                value={value}
                onSelect={commit}
              />
            )}
          </>
        )}
      </div>
    </BottomSheet>
  );
}

const EMPTY_SET: ReadonlySet<string> = new Set();

function CategoryTree({
  parentId,
  depth,
  maps,
  expandedIds,
  onToggleExpanded,
  value,
  onSelect,
}: {
  parentId: string | null;
  depth: number;
  maps: TreeMaps;
  expandedIds: Set<string>;
  onToggleExpanded: (id: string) => void;
  value: string | null;
  onSelect: (id: string) => void;
}) {
  const nodes = maps.byParent.get(parentId) ?? [];
  return (
    <>
      {nodes.map((node) => {
        const selected = value === node.id;
        const kids = maps.byParent.get(node.id) ?? [];
        const hasChildren = kids.length > 0;
        const expanded = expandedIds.has(node.id);
        return (
          <div key={node.id} className="space-y-1.5">
            <div
              className="flex items-stretch gap-1"
              style={{ paddingInlineStart: `${12 + depth * 16}px` }}
            >
              {hasChildren ? (
                <button
                  type="button"
                  aria-expanded={expanded}
                  aria-label={expanded ? `بستن زیرشاخه‌های ${node.name}` : `باز کردن زیرشاخه‌های ${node.name}`}
                  onClick={() => onToggleExpanded(node.id)}
                  className="ds-focus shrink-0 self-center p-2 rounded-control text-fg-muted hover:bg-hover hover:text-fg"
                >
                  {expanded ? <ChevronDown size={14} /> : <ChevronLeft size={14} />}
                </button>
              ) : (
                <span className="w-8 shrink-0" aria-hidden />
              )}
              <button
                type="button"
                onClick={() => onSelect(node.id)}
                aria-pressed={selected}
                className={`ds-focus min-w-0 flex-1 flex items-center gap-2 rounded-control p-3 text-start transition-colors ${
                  selected
                    ? 'bg-accent-soft'
                    : 'bg-panel hover:bg-hover'
                }`}
              >
              <span
                className="size-2.5 rounded-full shrink-0"
                style={{ backgroundColor: node.color }}
              />
              <Folder
                size={14}
                className={selected ? 'text-accent-ink' : 'text-fg-subtle'}
              />
              <span
                className={`flex-1 min-w-0 text-callout truncate ${
                  selected ? 'text-fg font-semibold' : 'text-fg'
                }`}
              >
                {node.name}
              </span>
              </button>
            </div>
            {hasChildren && expanded && (
              <CategoryTree
                parentId={node.id}
                depth={depth + 1}
                maps={maps}
                expandedIds={expandedIds}
                onToggleExpanded={onToggleExpanded}
                value={value}
                onSelect={onSelect}
              />
            )}
          </div>
        );
      })}
    </>
  );
}

// Multi-select state for song lists (Sollin capture §4 / state contracts).
// The model keeps three facts explicit: the loaded collection (caller-owned),
// the selected ids in tap order, and the total count used for 已选 N / 总数.
// Actions read the selection in the order their contract requires:
// - favorite batches consume tap order (E-1230: collection order = selection
//   order);
// - queue "play next" batches consume list order (E-1092/E-1214: insertion
//   follows the list, not the tap sequence).
export interface SelectionModel { active: boolean; ids: readonly string[] }
export const selectionNone: SelectionModel = { active: false, ids: [] }

export function selectionEnter(id: string): SelectionModel {
  return { active: true, ids: [id] }
}

export function selectionToggle(model: SelectionModel, id: string): SelectionModel {
  if (!model.active) return selectionEnter(id)
  return model.ids.includes(id)
    ? { ...model, ids: model.ids.filter(item => item !== id) }
    : { ...model, ids: [...model.ids, id] }
}

// Select-all adopts the loaded order: the tap sequence of a full selection is
// the list itself, so downstream orders agree.
export function selectionAll(model: SelectionModel, loadedIds: readonly string[]): SelectionModel {
  if (!model.active) return model
  return { active: true, ids: [...loadedIds] }
}

export function selectionExit(): SelectionModel {
  return selectionNone
}

export function selectionHas(model: SelectionModel, id: string): boolean {
  return model.active && model.ids.includes(id)
}

export function selectionCount(model: SelectionModel): number {
  return model.active ? model.ids.length : 0
}

/** Selected items in tap order. */
export function selectionByTapOrder<T>(model: SelectionModel, items: readonly T[], idOf: (item: T) => string): readonly T[] {
  const byId = new Map(items.map(item => [idOf(item), item] as const))
  return model.ids.map(id => byId.get(id)).filter((item): item is T => item !== undefined)
}

/** Selected items in the order they appear in the loaded list. */
export function selectionByListOrder<T>(model: SelectionModel, items: readonly T[], idOf: (item: T) => string): readonly T[] {
  const wanted = new Set(model.ids)
  return items.filter(item => wanted.has(idOf(item)))
}

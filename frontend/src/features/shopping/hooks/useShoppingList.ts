import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import toast from 'react-hot-toast'
import i18next from 'i18next'
import {
  getShoppingList,
  addShoppingItem,
  addShoppingItemsBulk,
  updateShoppingItem,
  deleteShoppingItem,
  deleteCheckedItems,
  deleteAllShoppingItems,
  completeShopping,
} from '@/features/shopping/api'
import type {
  ShoppingItem,
  ShoppingItemCreate,
  ShoppingItemUpdate,
  CompleteShoppingRequest,
} from '@/shared/lib/api.types'

const SHOPPING_KEY = ['shopping'] as const

export function useShoppingList() {
  return useQuery({ queryKey: SHOPPING_KEY, queryFn: getShoppingList })
}

export function useAddShoppingItem() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (item: ShoppingItemCreate) => addShoppingItem(item),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: SHOPPING_KEY })
    },
    onError: () => toast.error('Failed to add item', { id: 'shopping-action' }),
  })
}

export function useAddShoppingItemsBulk() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (items: ShoppingItemCreate[]) => addShoppingItemsBulk(items),
    onSuccess: (data) => {
      void qc.invalidateQueries({ queryKey: SHOPPING_KEY })
      toast.success(i18next.t('shopping.addedBulk', { count: data.length }), { id: 'shopping-action' })
    },
    onError: () => toast.error(i18next.t('shopping.completeFailed'), { id: 'shopping-action' }),
  })
}

export function useToggleShoppingItem() {
  const qc = useQueryClient()

  function sortLikeBackend(items: ShoppingItem[]) {
    return [...items].sort((a, b) => {
      if (a.is_checked !== b.is_checked) return Number(a.is_checked) - Number(b.is_checked)
      return new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
    })
  }

  return useMutation({
    mutationFn: ({ id, is_checked }: { id: number; is_checked: boolean }) =>
      updateShoppingItem(id, { is_checked }),
    onMutate: async ({ id, is_checked }) => {
      await qc.cancelQueries({ queryKey: SHOPPING_KEY })
      const previous = qc.getQueryData<ShoppingItem[]>(SHOPPING_KEY)

      qc.setQueryData<ShoppingItem[]>(SHOPPING_KEY, (old) => {
        if (!old) return old
        const next = old.map((item) =>
          item.id === id ? { ...item, is_checked } : item
        )
        return sortLikeBackend(next)
      })

      return { previous }
    },
    onError: (_err, _vars, ctx) => {
      if (ctx?.previous) qc.setQueryData(SHOPPING_KEY, ctx.previous)
      toast.error('Failed to update item', { id: 'shopping-action' })
    },
    onSettled: () => {
      void qc.invalidateQueries({ queryKey: SHOPPING_KEY })
    },
  })
}

export function useUpdateShoppingItem() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ id, update }: { id: number; update: ShoppingItemUpdate }) =>
      updateShoppingItem(id, update),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: SHOPPING_KEY })
    },
  })
}

export function useDeleteShoppingItem() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (id: number) => deleteShoppingItem(id),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: SHOPPING_KEY })
    },
    onError: () => toast.error('Failed to delete item', { id: 'shopping-action' }),
  })
}

export function useDeleteCheckedItems() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: deleteCheckedItems,
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: SHOPPING_KEY })
    },
    onError: () => toast.error('Failed to clear items', { id: 'shopping-action' }),
  })
}

export function useDeleteAllShoppingItems() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: deleteAllShoppingItems,
    onSuccess: (data) => {
      void qc.invalidateQueries({ queryKey: SHOPPING_KEY })
      toast.success(i18next.t('shopping.clearedAll', { count: data.deleted_count }), { id: 'shopping-action' })
    },
    onError: () => toast.error(i18next.t('shopping.clearAllFailed', 'Failed to clear list'), { id: 'shopping-action' }),
  })
}

export function useCompleteShopping() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (req: CompleteShoppingRequest) => completeShopping(req),
    onSuccess: (data) => {
      void qc.invalidateQueries({ queryKey: SHOPPING_KEY })
      void qc.invalidateQueries({ queryKey: ['inventory'] })
      void qc.invalidateQueries({ queryKey: ['recipes'] })
      if (data.failed_items.length > 0) {
        toast.error(i18next.t('shopping.completeFailed'), { id: 'shopping-complete' })
      } else {
        toast.success(i18next.t('shopping.completeSuccess', { count: data.added_count }), { id: 'shopping-complete' })
      }
    },
    onError: () => toast.error(i18next.t('shopping.completeFailed'), { id: 'shopping-complete' }),
  })
}
